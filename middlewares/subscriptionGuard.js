const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const subscriptionGuardMiddleware = async (req, res, next) => {
  try {
    if (!req.client_id) {
      return res.status(403).json({ error: 'Client ID missing' });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('client_id', req.client_id)
      .maybeSingle();

    if (error) {
      logger.error(`Subscription check error: ${error.message}`);
      return res.status(500).json({ error: 'Failed to check subscription' });
    }

    if (!data || data.status !== 'active') {
      logger.warn(`Blocked access for client ${req.client_id}: status ${data?.status}`);
      return res.status(403).json({ error: 'Subscription not active', status: 'blocked' });
    }

    next();
  } catch (err) {
    logger.error(`Subscription guard exception: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = subscriptionGuardMiddleware;
