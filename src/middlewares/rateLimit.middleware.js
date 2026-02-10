const redis = require('../../utils/redis');

/**
 * Middleware de Rate Limit distribuído via Redis
 * @param {number} limit - Máximo de requisições
 * @param {number} windowSeconds - Janela de tempo em segundos
 */
const rateLimit = (limit = 100, windowSeconds = 60) => {
  return async (req, res, next) => {
    try {
      // Identificador único: CompanyID (se logado) ou IP
      const keyId = req.companyId ? `company:${req.companyId}` : `ip:${req.ip}`;
      const key = `ratelimit:${keyId}`;

      const requests = await redis.incr(key);

      if (requests === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Headers informativos
      res.set('X-RateLimit-Limit', limit);
      res.set('X-RateLimit-Remaining', Math.max(0, limit - requests));

      if (requests > limit) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Você excedeu o limite de requisições. Tente novamente mais tarde.'
        });
      }

      next();
    } catch (err) {
      console.error('[RateLimit] Erro no Redis', err);
      // Em caso de falha do Redis, permite passar (Fail Open) para não derrubar a API
      next();
    }
  };
};

module.exports = rateLimit;
