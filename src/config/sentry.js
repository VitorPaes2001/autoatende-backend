const Sentry = require('@sentry/node');
const {
  sanitizeBreadcrumb,
  sanitizeHeaders,
  sanitizeSentryEvent,
} = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');

function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    safeLogger.warn('Sentry DSN not configured');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
  });

  // Middleware manual de request (compatível com v10)
  app.use((req, res, next) => {
    Sentry.getCurrentScope().setContext('request', {
      method: req.method,
      url: String(req.originalUrl || req.url || '').split('?')[0],
      headers: sanitizeHeaders(req.headers),
    });
    next();
  });

  safeLogger.info('Sentry initialized');
}

module.exports = {
  initSentry,
  Sentry,
};

