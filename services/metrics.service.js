const supabase = require('../config/supabase');

const getMetrics = async (clientId) => {
  const { count: totalConversations } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  const { count: botConversations } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'bot');

  return {
    total_conversations: totalConversations,
    bot_conversations: botConversations,
    human_conversations: totalConversations - botConversations,
  };
};

module.exports = {
  getMetrics
};
