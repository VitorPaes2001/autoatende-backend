const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const ensureClient = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    // Check if client exists using user_id
    let { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      logger.info(`Creating new client for user ${user.email}`);
      
      const isPro = user.email === 'admin@autoatendeai.com.br';
      const plan = isPro ? 'pro' : 'start';
      const status = 'active';

      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          email: user.email,
          plan: plan,
          plan_status: status,
          bot_active: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        logger.error(`Failed to create client: ${insertError.message}`);
         let { data: retryClient } = await supabase.from('clients').select('*').eq('user_id', user.id).maybeSingle();
         if (retryClient) {
            client = retryClient;
         } else {
            return res.status(500).json({ error: 'Failed to initialize client account' });
         }
      } else {
        client = newClient;
      }
    }

    req.client = client;
    req.client_id = client.id;
    next();
  } catch (err) {
    logger.error(`Ensure client middleware error: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = ensureClient;
