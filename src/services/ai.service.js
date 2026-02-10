const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../../utils/logger');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Transcreve arquivo de áudio usando OpenAI Whisper
 * @param {string} filePath - Caminho absoluto do arquivo de áudio
 * @returns {Promise<string>} - Texto transcrito
 */
async function transcribeAudio(filePath) {
  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      timeout: 30000 // 30s timeout
    });

    return response.data.text;
  } catch (error) {
    logger.error('[AI Service] Transcription failed', error);
    throw new Error('Failed to transcribe audio');
  }
}

/**
 * Gera resposta de chat usando OpenAI GPT-4o-mini (mais rápido/barato)
 * @param {Array} messages - Histórico de mensagens [{role: 'user', content: '...'}, ...]
 * @param {string} systemPrompt - Prompt do sistema (Onboarding context)
 * @returns {Promise<string>} - Resposta da IA
 */
async function generateResponse(messages, systemPrompt) {
  try {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const payload = {
      model: 'gpt-4o-mini', // Ou gpt-3.5-turbo se preferir
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000 // 20s timeout
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error('[AI Service] Chat completion failed', error);
    throw new Error('Failed to generate response');
  }
}

module.exports = {
  transcribeAudio,
  generateResponse
};