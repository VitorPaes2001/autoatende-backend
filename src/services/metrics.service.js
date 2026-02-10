const supabase = require('../config/supabase');
const companyService = require('./company.service');
const AppError = require('../utils/AppError');

/**
 * Service de Métricas Operacionais
 */

/**
 * Obtém visão geral da empresa (Financeiro, Uso, Atendimento)
 */
async function getCompanyOverview(companyId) {
  // 1. Obter dados da empresa e assinatura
  const company = await companyService.getCompany(companyId);
  if (!company) throw new AppError('Company not found', 404);

  const subscription = await companyService.getSubscription(company.client_id);
  
  // Defaults se não tiver assinatura/uso
  const overview = {
    financial: {
      status: subscription?.status || 'none',
      plan: subscription?.plan?.name || 'none'
    },
    usage: {
      conversations: {
        total: subscription?.plan?.conversations_limit || 0,
        used: 0,
        remaining: 0
      },
      templates: {
        total: subscription?.plan?.templates_limit || 0,
        used: 0,
        remaining: 0
      }
    },
    attendance: {
      bot: 0,
      human: 0,
      total_tracked: 0,
      bot_percent: 0,
      human_percent: 0
    }
  };

  // 2. Obter uso mensal atual
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Try to select agents_used, but fallback if column missing (handled via try/catch in lazy init if needed)
  // Actually, better to stick to core columns to avoid crashes if schema drifts.
  // Agents are counted live from 'users' table in most logic, so we can omit here or make it optional.
  let { data: usage, error: usageError } = await supabase
    .from('monthly_usage')
    .select('conversations_used, templates_used') // Removed agents_used to prevent schema error
    .eq('client_id', company.client_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  // Lazy Initialization: Se não existir, cria
  if (!usage && !usageError) {
    try {
      // const initialAgents = subscription?.plan?.max_agents || 1; 
      // Removed agents_used from insert to be safe against schema mismatch
      
      const { data: newUsage, error: createError } = await supabase
        .from('monthly_usage')
        .insert({
          client_id: company.client_id,
          month,
          year,
          conversations_used: 0,
          templates_used: 0
          // agents_used: initialAgents 
        })
        .select()
        .single();
        
      if (!createError) {
        usage = newUsage;
        console.log(`[Metrics] Created monthly_usage for client ${company.client_id}`);
      } else {
        console.error('[Metrics] Failed to auto-create monthly_usage:', createError);
      }
    } catch (e) {
      console.error('[Metrics] Error in lazy init:', e);
    }
  }

  if (usage) {
    overview.usage.conversations.used = usage.conversations_used || 0;
    overview.usage.conversations.remaining = Math.max(0, overview.usage.conversations.total - (usage.conversations_used || 0));
    
    overview.usage.templates.used = usage.templates_used || 0;
    overview.usage.templates.remaining = Math.max(0, overview.usage.templates.total - (usage.templates_used || 0));
  }

  // 3. Obter métricas de atendimento (Snapshot atual)
  // Agregação via SQL (count by mode)
  // Como Supabase JS não faz groupBy count direto facilmente sem RPC, vamos buscar raw records ou usar uma query aproximada.
  // Se a tabela for grande, isso é ruim. Mas para dashboard de uma empresa específica, deve ser ok.
  // Melhor: Select count filtered.
  
  const { count: botCount, error: errBot } = await supabase
    .from('conversation_states')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('mode', 'bot');

  const { count: humanCount, error: errHuman } = await supabase
    .from('conversation_states')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('mode', 'human');

  const total = (botCount || 0) + (humanCount || 0);
  
  overview.attendance.bot = botCount || 0;
  overview.attendance.human = humanCount || 0;
  overview.attendance.total_tracked = total;
  
  if (total > 0) {
    overview.attendance.bot_percent = parseFloat(((botCount / total) * 100).toFixed(1));
    overview.attendance.human_percent = parseFloat(((humanCount / total) * 100).toFixed(1));
  }

  return overview;
}

/**
 * Obtém métricas temporais (Volume de mensagens)
 */
async function getDailyVolume(companyId, days = 30) {
  // Data de corte
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  // Busca mensagens
  // Nota: Idealmente usar RPC function para agregação no DB.
  // Como não posso criar migration/RPC facilmente agora, vou buscar apenas timestamp e agregar no código (Node.js).
  // Cuidado com volume. Limitando a últimas 5000 mensagens para performance se necessário, ou assumindo volume baixo.
  // Vamos tentar buscar apenas created_at.
  
  const { data: messages, error } = await supabase
    .from('messages')
    .select('created_at')
    .eq('company_id', companyId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Metrics] Error fetching messages', error);
    throw new AppError('Failed to fetch temporal metrics', 500);
  }

  // Agregação em memória
  const dailyMap = {};
  
  // Inicializa dias zerados
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyMap[key] = 0;
  }

  messages.forEach(msg => {
    const key = msg.created_at.split('T')[0];
    if (dailyMap[key] !== undefined) {
      dailyMap[key]++;
    }
  });

  // Converte para array ordenado
  const history = Object.keys(dailyMap).sort().map(date => ({
    date,
    count: dailyMap[date]
  }));

  // Estatísticas
  const counts = history.map(h => h.count);
  const max = Math.max(...counts, 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const avg = total / days;

  return {
    period: `${days} days`,
    total_messages: total,
    daily_peak: max,
    average_daily: parseFloat(avg.toFixed(1)),
    history
  };
}

module.exports = {
  getCompanyOverview,
  getDailyVolume
};
