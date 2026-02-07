const redis = require('../utils/redis');
const logger = require('../utils/logger');

class ConversationWindowService {
  constructor() {
    this.WINDOW_TTL = 60 * 60 * 24; // 24h
  }

  key(companyId, phone) {
    return `conversation:${companyId}:${phone.replace(/\D/g, '')}`;
  }

  async handleInboundMessage(companyId, phone) {
    const key = this.key(companyId, phone);
    const exists = await redis.exists(key);

    if (!exists) {
      await redis.set(
        key,
        JSON.stringify({ openedAt: new Date().toISOString() }),
        'EX',
        this.WINDOW_TTL
      );

      logger.info(`[Window] Nova conversa aberta ${companyId}:${phone}`);
      return { opened: true };
    }

    await redis.expire(key, this.WINDOW_TTL);
    return { opened: false };
  }
}

module.exports = new ConversationWindowService();

