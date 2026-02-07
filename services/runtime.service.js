const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const systemEvents = require('./systemEvents.service');

const getRuntimeContext = async (payload) => {
  const { phone_number, from, message } = payload;

  if (!phone_number || !from) {
    throw new Error('Missing required fields: phone_number, from');
  }

  // 1. Identify Client by WhatsApp Phone Number ID
  const { data: waAccount, error: waError } = await supabase
    .from('whatsapp_accounts')
    .select('client_id, id')
    .eq('phone_number', phone_number)
    .maybeSingle();

  if (waError || !waAccount) {
    logger.warn(`WhatsApp account not found for phone_number: ${phone_number}`);
    throw new Error('Instance not found');
  }

  const clientId = waAccount.client_id;
  
  // 2. Fetch Client Context
  const [clientRes, settingsRes, subscriptionRes] = await Promise.all([
    supabase.from('clients').select('status').eq('id', clientId).single(),
    supabase.from('bot_settings').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('subscriptions').select('status').eq('client_id', clientId).maybeSingle()
  ]);

  const clientStatus = clientRes.data?.status || 'inactive';
  const subscriptionStatus = subscriptionRes.data?.status || 'inactive';
  
  const effectiveClientStatus = (clientStatus === 'active' && subscriptionStatus === 'active') ? 'active' : 'inactive';
  
  let botActive = false;
  let prompt = "Você é o assistente virtual.";
  let fallback = "Olá! Como posso ajudar?";
  let aiEnabled = true;
  
  if (settingsRes.data) {
    botActive = settingsRes.data.active;
    if (settingsRes.data.config) {
      prompt = settingsRes.data.config.prompt || prompt;
      if (typeof settingsRes.data.config.ai_enabled !== 'undefined') {
        aiEnabled = settingsRes.data.config.ai_enabled;
      }
    }
  }

  // 3. Check/Create Conversation
  let { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', clientId)
    .eq('contact_phone', from)
    .maybeSingle();

  if (!conversation) {
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        client_id: clientId,
        contact_phone: from,
        status: 'bot',
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      logger.error(`Failed to create conversation: ${createError.message}`);
      throw new Error('Failed to create conversation');
    }
    conversation = newConv;
  } else {
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
  }

  // 4. Check Limits
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  
  const { count: usageCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('last_message_at', startOfMonth.toISOString());
    
  const limit = 1000;
  const monthlyReached = (usageCount || 0) >= limit;
  
  const conversationStatus = conversation.status;

  if (monthlyReached) {
    botActive = false; 
    await systemEvents.logEvent(clientId, 'monthly_limit_reached', { usage: usageCount });
  }

  return {
    client_status: effectiveClientStatus,
    bot_active: botActive,
    conversation_status: conversationStatus,
    limits: { monthly_reached: monthlyReached },
    reply: { 
      type: "ai", 
      text: null, 
      fallback: fallback 
    },
    ai: { 
      enabled: aiEnabled, 
      prompt: prompt 
    },
    memory: { 
      summary: conversation.summary || "" 
    }
  };
};

module.exports = {
  getRuntimeContext
};
