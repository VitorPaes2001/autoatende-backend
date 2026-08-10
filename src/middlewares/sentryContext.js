const Sentry = require('@sentry/node');
const {
  pseudonymizeIdentifier,
  safeErrorFields,
} = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');

module.exports = function sentryContext(req, res, next) {
  try {
    const scope = Sentry.getCurrentScope();

    // 🔹 Request básico
    scope.setTag('method', req.method);
    scope.setTag('route', String(req.originalUrl || req.url || '').split('?')[0]);

    // 🔹 Identificadores de negócio
    const companyId = req.companyId || req.company_id || req.user?.company_id;

    if (companyId) {
      const companyRef = pseudonymizeIdentifier(companyId);
      scope.setUser({ id: companyRef });
      scope.setTag('company_ref', companyRef);
    }
  } catch (err) {
    safeLogger.error('SentryContext failure', safeErrorFields(err));
  }

  next();
};

