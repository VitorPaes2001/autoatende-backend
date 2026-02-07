const Sentry = require('@sentry/node');

module.exports = function sentryContext(req, res, next) {
  try {
    const scope = Sentry.getCurrentScope();

    // 🔹 Request básico
    scope.setTag('method', req.method);
    scope.setTag('route', req.originalUrl);

    // 🔹 Identificadores de negócio
    const companyId =
      req.body?.company_id ||
      req.headers['x-company-id'];

    const conversationId =
      req.body?.conversation_id ||
      req.headers['x-conversation-id'];

    const from =
      req.body?.from ||
      req.headers['x-from'];

    if (companyId) {
      scope.setUser({ id: companyId });
      scope.setTag('company_id', companyId);
    }

    if (conversationId) {
      scope.setTag('conversation_id', conversationId);
    }

    if (from) {
      scope.setTag('from', from);
    }

    // 🔹 Payload (com limite)
    if (req.body) {
      scope.setContext('payload', {
        body: JSON.stringify(req.body).slice(0, 2000)
      });
    }
  } catch (err) {
    console.error('[SentryContext error]', err);
  }

  next();
};

