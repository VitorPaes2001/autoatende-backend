const Sentry = require('@sentry/node');

function initSentry(app) {
  if (!process.env.SENTRY_DSN) {
    console.warn('🟡 Sentry DSN não configurado');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });

  // Middleware manual de request (compatível com v10)
  app.use((req, res, next) => {
    Sentry.getCurrentScope().setContext('request', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
    });
    next();
  });

  console.log('🟣 Sentry inicializado');
}

module.exports = {
  initSentry,
  Sentry,
};

