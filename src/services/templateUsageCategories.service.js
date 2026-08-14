// __AUTOATENDE_C10G_R2C_TEMPLATE_USAGE_CATEGORIES_READPATH__
const TEMPLATE_USAGE_CATEGORY_MARKETING = 'marketing';
const TEMPLATE_USAGE_CATEGORY_UTILITY_AUTH = 'utility_auth';

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeTemplateUsageCategory(rawCategory) {
  const value = String(rawCategory || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[/-]+/g, '_');

  if (!value) return TEMPLATE_USAGE_CATEGORY_UTILITY_AUTH;
  if (value === 'marketing' || value === 'mkt') return TEMPLATE_USAGE_CATEGORY_MARKETING;

  if (
    value === 'utility' ||
    value === 'authentication' ||
    value === 'auth' ||
    value === 'utility_auth' ||
    value === 'utility_authentication' ||
    value === 'utility_authentication_service' ||
    value === 'service' ||
    value === 'utilityauthentication'
  ) {
    return TEMPLATE_USAGE_CATEGORY_UTILITY_AUTH;
  }

  return TEMPLATE_USAGE_CATEGORY_UTILITY_AUTH;
}

function extractTemplateUsageByCategory(row = {}) {
  const hasMarketingDirect = hasOwn(row, 'marketing_templates_used') && row.marketing_templates_used != null;
  const hasUtilityAuthDirect = hasOwn(row, 'utility_auth_templates_used') && row.utility_auth_templates_used != null;
  const hasLegacyUtility = hasOwn(row, 'utility_templates_used') && row.utility_templates_used != null;
  const hasLegacyAuth = hasOwn(row, 'authentication_templates_used') && row.authentication_templates_used != null;
  const hasTotal = hasOwn(row, 'templates_used') && row.templates_used != null;

  const marketing = hasMarketingDirect ? toSafeNumber(row.marketing_templates_used) : 0;

  let utilityAuth = 0;
  let source = 'empty';

  if (hasUtilityAuthDirect) {
    utilityAuth = toSafeNumber(row.utility_auth_templates_used);
    source = 'direct_split';
  } else if (hasLegacyUtility || hasLegacyAuth) {
    utilityAuth = toSafeNumber(row.utility_templates_used) + toSafeNumber(row.authentication_templates_used);
    source = 'legacy_split';
  } else if (hasTotal && !hasMarketingDirect) {
    utilityAuth = toSafeNumber(row.templates_used);
    source = 'total_fallback_all_utility_auth';
  } else if (hasTotal) {
    utilityAuth = Math.max(toSafeNumber(row.templates_used) - marketing, 0);
    source = 'total_minus_marketing';
  }

  const total = hasTotal ? toSafeNumber(row.templates_used) : (marketing + utilityAuth);

  return {
    marketing,
    utilityAuth,
    total,
    source,
  };
}

function withTemplateUsageCategories(row = {}) {
  const usage = extractTemplateUsageByCategory(row);

  return {
    ...row,
    marketing_templates_used: usage.marketing,
    utility_auth_templates_used: usage.utilityAuth,
    templates_used: usage.total,
    template_usage_breakdown: {
      marketing: usage.marketing,
      utility_auth: usage.utilityAuth,
      total: usage.total,
      source: usage.source,
    },
  };
}

function buildIncrementPatch(category, amount = 1) {
  const normalizedCategory = normalizeTemplateUsageCategory(category);
  const safeAmount = Math.max(0, toSafeNumber(amount) || 0);

  if (normalizedCategory === TEMPLATE_USAGE_CATEGORY_MARKETING) {
    return {
      marketing_templates_used: safeAmount,
      utility_auth_templates_used: 0,
      templates_used: safeAmount,
    };
  }

  return {
    marketing_templates_used: 0,
    utility_auth_templates_used: safeAmount,
    templates_used: safeAmount,
  };
}

function looksLikeTemplateUsageObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const keys = [
    'templates_used',
    'marketing_templates_used',
    'utility_auth_templates_used',
    'utility_templates_used',
    'authentication_templates_used',
  ];

  return keys.some((key) => hasOwn(value, key));
}

function canonicalizeTemplateUsagePayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(canonicalizeTemplateUsagePayload);
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const base = looksLikeTemplateUsageObject(payload)
    ? withTemplateUsageCategories(payload)
    : { ...payload };

  for (const [key, value] of Object.entries(base)) {
    if (Array.isArray(value)) {
      base[key] = value.map(canonicalizeTemplateUsagePayload);
    } else if (value && typeof value === 'object') {
      base[key] = canonicalizeTemplateUsagePayload(value);
    }
  }

  return base;
}

module.exports = {
  TEMPLATE_USAGE_CATEGORY_MARKETING,
  TEMPLATE_USAGE_CATEGORY_UTILITY_AUTH,
  normalizeTemplateUsageCategory,
  extractTemplateUsageByCategory,
  withTemplateUsageCategories,
  buildIncrementPatch,
  looksLikeTemplateUsageObject,
  canonicalizeTemplateUsagePayload,
};
