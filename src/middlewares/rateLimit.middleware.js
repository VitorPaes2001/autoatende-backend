// __AUTOATENDE_C6C_R3_RATE_LIMIT_BUCKET_ISOLATION__
const redis = require('../../utils/redis');

/**
 * Middleware de Rate Limit distribuído via Redis
 * @param {number} limit - Máximo de requisições
 * @param {number} windowSeconds - Janela de tempo em segundos
 */
const rateLimit = (limit = 100, windowSeconds = 60, bucket = 'global') => {
  return async (req, res, next) => {
    // __AUTOATENDE_C7F_R6B_ATTENDANCE_WRITE_BYPASS__
    const __aaRateLimitPath = String(req.originalUrl || req.url || req.path || '').split('?')[0];
    const __aaIsAttendanceWriteBypass =
      req.method === 'POST' && (
        /\/attendance\/return\/bot(?:\/|$)/.test(__aaRateLimitPath) ||
        /\/attendance\/transfer\/human(?:\/|$)/.test(__aaRateLimitPath) ||
        /\/attendance\/transfer\/agent(?:\/|$)/.test(__aaRateLimitPath)
      );
    if (__aaIsAttendanceWriteBypass) {
      return next();
    }

    try {
      // Identificador único: CompanyID / clientId / userId / IP
      const keyId =
        (req.companyId && `company:${req.companyId}`) ||
        (req.user?.companyId && `company:${req.user.companyId}`) ||
        (req.user?.clientId && `client:${req.user.clientId}`) ||
        (req.user?.id && `user:${req.user.id}`) ||
        `ip:${req.ip}`;

      const bucketName = bucket || 'global';
      const key = `ratelimit:${bucketName}:${keyId}`;

      const requests = await redis.incr(key);

      if (requests === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Headers informativos
      res.set('X-RateLimit-Limit', limit);
      res.set('X-RateLimit-Remaining', Math.max(0, limit - requests));
      res.set('X-RateLimit-Bucket', bucketName);

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
