// __AUTOATENDE_C10G_R2C_CANONICALIZE_TEMPLATE_USAGE_PAYLOAD_MIDDLEWARE__
const { canonicalizeTemplateUsagePayload } = require('../services/templateUsageCategories.service');

function canonicalizeTemplateUsagePayloadMiddleware(req, res, next) {
  if (res.__autoatendeTemplateUsageCanonicalized) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function patchedJson(body) {
    try {
      const canonical = canonicalizeTemplateUsagePayload(body);
      return originalJson(canonical);
    } catch (error) {
      console.error('[C10G_R2C] canonicalizeTemplateUsagePayloadMiddleware_error', {
        message: error?.message || String(error),
      });
      return originalJson(body);
    }
  };

  res.__autoatendeTemplateUsageCanonicalized = true;
  next();
}

module.exports = {
  canonicalizeTemplateUsagePayloadMiddleware,
};
