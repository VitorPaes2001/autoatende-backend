const supabase = require('../config/supabase');
const logger = require('../utils/logger');

const logEvent = async (clientId, eventType, metadata = {}) => {
  try {
    const { error } = await supabase
      .from('system_events')
      .insert({
        client_id: clientId,
        event_type: eventType,
        payload: metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      logger.error(`Failed to log event ${eventType}: ${error.message}`);
    } else {
      logger.info(`Event logged: ${eventType} for client ${clientId}`);
    }
  } catch (err) {
    logger.error(`Exception logging event: ${err.message}`);
  }
};

module.exports = {
  logEvent
};
