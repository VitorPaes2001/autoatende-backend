const { handleInboundMessage } = require('./conversationWindow.service');
const { consumeUsage } = require('./usage.service');
const { getCompany, getActivePlan } = require('./company.service');
const attendanceService = require('./attendance.service');
const audioService = require('./audio.service');
const aiService = require('./ai.service');
const whatsappService = require('./whatsapp.service');
const onboardingService = require('./onboarding.service');
const logger = require('../../utils/logger');

// Rate Limiter (In-Memory)
const rateLimiter = new Map();

/**
 * Verifica limites de taxa por usuário
 * @param {string} key - Identificador único (company:user)
 * @param {string} type - 'text' ou 'audio'
 * @returns {boolean} - true se permitido, false se bloqueado
 */
function checkRateLimit(key, type) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const limits = { text: 20, audio: 5 };
  
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { start: now, text: 0, audio: 0 });
  }
  
  const usage = rateLimiter.get(key);
  
  // Reset se passou a janela
  if (now - usage.start > windowMs) {
    usage.start = now;
    usage.text = 0;
    usage.audio = 0;
  }
  
  usage[type]++;
  return usage[type] <= limits[type];
}

/**
 * Orquestra o processamento de mensagens inbound do WhatsApp
 * Nunca lança erro de regra de negócio
 */
async function handleIncomingWhatsAppMessage(payload) {
  const { company_id, from, message } = payload;

  if (!company_id || !from || !message) {
    return {
      blocked: true,
      reason: 'INVALID_PAYLOAD',
    };
  }

  try {
    // 1️⃣ Empresa
    const company = await getCompany(company_id);
    if (!company) {
      return {
        blocked: true,
        reason: 'COMPANY_NOT_FOUND',
      };
    }

    // 2️⃣ Plano ativo
    const planData = await getActivePlan(company.client_id);
    if (!planData) {
      return {
        blocked: true,
        reason: 'NO_ACTIVE_SUBSCRIPTION',
      };
    }

    // 3️⃣ Janela de conversa (Métricas apenas - Billing desacoplado)
    const window = await handleInboundMessage(company_id, from);

    // 4️⃣ Verificação de Atendimento (Bot vs Humano)
    const state = await attendanceService.getConversationState(company_id, from);
    
    if (state.mode === 'human') {
      logger.info(`[Bot Skipped] Conversation in human mode for ${from}`);
      return {
        success: true,
        conversationOpened: window.opened,
        botSkipped: true,
        assignedAgent: state.assigned_agent_id
      };
    }

    // 5️⃣ Processamento de Mensagem (Texto ou Áudio)
    let userText = '';
    const rateLimitKey = `${company_id}:${from}`;

    if (message.type === 'text') {
      if (!checkRateLimit(rateLimitKey, 'text')) {
        logger.warn(`[Rate Limit] Text limit exceeded for ${from}`);
        return { blocked: true, reason: 'RATE_LIMIT_EXCEEDED' };
      }
      userText = message.text.body;
    } else if (message.type === 'audio') {
      if (!checkRateLimit(rateLimitKey, 'audio')) {
        logger.warn(`[Rate Limit] Audio limit exceeded for ${from}`);
        await whatsappService.sendMessage(company.client_id, from, '⏳ Você está enviando muitos áudios. Aguarde um pouco.');
        return { blocked: true, reason: 'RATE_LIMIT_EXCEEDED' };
      }

      // Validação de Tamanho (se disponível no payload)
      // Limite: 5MB (aprox 5 * 1024 * 1024 bytes)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (message.audio.file_size && message.audio.file_size > MAX_SIZE) {
        logger.warn(`[Audio] File too large: ${message.audio.file_size}`);
        await whatsappService.sendMessage(company.client_id, from, '⚠️ Áudio muito grande. Tente enviar um menor (máx 5MB).');
        return { blocked: true, reason: 'AUDIO_TOO_LARGE' };
      }

      try {
        logger.info(`[Audio] Processing audio message ${message.audio.id}`);
        // Baixar e transcrever
        const filePath = await audioService.downloadMedia(message.audio.id, company.client_id);
        
        // Verificar tamanho do arquivo baixado (segurança extra)
        const stats = require('fs').statSync(filePath);
        if (stats.size > MAX_SIZE) {
            require('fs').unlinkSync(filePath); // Deleta arquivo
            throw new Error('Downloaded file too large');
        }

        userText = await aiService.transcribeAudio(filePath);
        logger.info(`[Audio] Transcribed: "${userText}"`);
        
        // Cleanup: Deletar arquivo após transcrição
        require('fs').unlink(filePath, (err) => {
          if (err) logger.warn('[Audio] Failed to delete temp file', err);
        });

      } catch (err) {
        logger.error('[Audio] Failed to process', err);
        await whatsappService.sendMessage(company.client_id, from, '😕 Não consegui ouvir seu áudio. Pode escrever?');
        return { success: false, error: 'AUDIO_PROCESS_FAILED' };
      }
    } else {
      // Outros tipos de mídia ignorados por enquanto
      return { success: true, ignored: true };
    }

    // 6️⃣ Onboarding Conversacional (#setup)
    // Se o usuário mandar #setup ou estiver em fluxo de onboarding
    const isOnboarding = await onboardingService.isOnboardingActive(company_id, from);
    
    if (userText.trim().toLowerCase() === '#setup' || isOnboarding) {
      const nextStep = await onboardingService.processOnboardingStep(company_id, from, userText);
      if (nextStep && nextStep.message) {
        await whatsappService.sendMessage(company.client_id, from, nextStep.message);
      }
      return { success: true, onboarding: true };
    }

    // 7️⃣ Resposta via AI (Fluxo normal)
    // Recuperar contexto do onboarding para o System Prompt
    const onboardingData = await onboardingService.getOnboardingData(company_id);
    const systemPrompt = onboardingService.buildSystemPrompt(onboardingData);

    // Montar histórico (simplificado por enquanto: System + User)
    // Idealmente buscaria mensagens anteriores do banco
    const messages = [
      { role: 'user', content: userText }
    ];

    const aiResponse = await aiService.generateResponse(messages, systemPrompt);
    
    // Enviar resposta
    await whatsappService.sendMessage(company.client_id, from, aiResponse);

    return {
      success: true,
      conversationOpened: window.opened,
      responseSent: true
    };

  } catch (error) {
    logger.error('[WhatsApp Handler] Critical error', error);
    return {
      blocked: true,
      reason: 'INTERNAL_ERROR'
    };
  }
}

module.exports = {
  handleIncomingWhatsAppMessage,
};

