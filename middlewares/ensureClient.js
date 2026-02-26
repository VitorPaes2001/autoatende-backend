const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const ensureClient = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    // ✅ Schema real: clients.id = auth.users.id
    let { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      logger.error(`EnsureClient select error: ${error.message}`);
    }

    if (!client) {
      logger.info(`Creating new client for auth user ${user.email}`);

      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          id: user.id,
          name: 'AutoAtende AI',
          email: user.email,
          status: 'active',
          plan: 'starter',
          plan_status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        logger.error(`Failed to create client: ${insertError.message}`);
        return res.status(500).json({ error: 'Failed to initialize client account' });
      }
      client = newClient;
    }

    req.client = client;
    req.clientId = client.id;
    req.client_id = client.id;
    next();
  } catch (err) {
    logger.error(`Ensure client middleware error: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = ensureClient;
