// __AUTOATENDE_C6C_R1_BILLING_PORTAL_SELF_HEAL__
const billingService = require('../services/billing.service');
// __AUTOATENDE_C10D_R2_BILLING_STATUS_COMMERCIAL_METADATA__
const { getCommercialPlanByAnyKey, COMMERCIAL_ADDONS } = require('../config/plans');
const overageBillingService = require('../services/overageBilling.service');
const { canonicalizeTemplateUsagePayload, extractTemplateUsageByCategory } = require('../services/templateUsageCategories.service');
const supabase = require('../config/supabase');
const { isSupabaseAdminUnavailableError } = supabase;

async function getStatus(req, res) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    if (!clientId) return res.status(401).json({ error: 'Unauthorized' });

    // companyId pode não estar no req dependendo do middleware
    let companyId = req.companyId || req.user?.companyId || null;
    if (!companyId) {
      const { data: company, error } = await supabase
        .from('companies')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();
      if (!error && company?.id) companyId = company.id;
    }

    const status = await billingService.getBillingStatus(companyId, clientId);
    const commercial =
      getCommercialPlanByAnyKey(status?.plan) ||
      getCommercialPlanByAnyKey(status?.planDisplayName) ||
      getCommercialPlanByAnyKey(status?.commercial?.displayName) ||
      null;      const monthlySummaryRaw = await overageBillingService
        .getMonthlyUsageSummary(clientId)
        .catch((error) => {
          if (isSupabaseAdminUnavailableError(error)) throw error;
          return null;
        });

      const monthlySummary = canonicalizeTemplateUsagePayload(monthlySummaryRaw || {});
      const monthlyTemplateUsage = extractTemplateUsageByCategory(monthlySummary);

    const commercialIncluded = commercial?.included || {};

    const normalizedLimits = {
      ...(status?.limits || {}),
      templates: commercialIncluded.templatesTotal ?? status?.limits?.templates ?? 0,
      marketingTemplates: commercialIncluded.marketingTemplates ?? status?.limits?.marketingTemplates ?? 0,
      utilityAuthTemplates: commercialIncluded.utilityAuthTemplates ?? status?.limits?.utilityAuthTemplates ?? 0,
      agents: commercialIncluded.agents ?? status?.limits?.agents ?? 1
    };

    const normalizedUsage = {
        ...(status?.usage || {}),
        conversations:
          monthlySummary?.conversations_used ??
          monthlySummary?.conversationsUsed ??
          status?.usage?.conversations ??
          0,
        templates:
          monthlySummary?.templates_used ??
          monthlySummary?.templatesUsed ??
          status?.usage?.templates ??
          0,
        marketingTemplates:
          monthlyTemplateUsage?.marketing ??
          monthlySummary?.marketing_templates_used ??
          monthlySummary?.marketingTemplatesUsed ??
          status?.usage?.marketingTemplates ??
          0,
        utilityAuthTemplates:
          monthlyTemplateUsage?.utilityAuth ??
          monthlySummary?.utility_auth_templates_used ??
          monthlySummary?.utilityAuthTemplatesUsed ??
          status?.usage?.utilityAuthTemplates ??
          0,
        overageTemplates:
          monthlySummary?.overage_templates ??
          monthlySummary?.overageTemplates ??
          status?.usage?.overageTemplates ??
          0,
        overageAmountBrlCents:
          monthlySummary?.overage_amount_brl_cents ??
          monthlySummary?.overageAmountBrlCents ??
          status?.usage?.overageAmountBrlCents ??
          0,
        overageUnitAmountBrlCents:
          monthlySummary?.overage_unit_amount_brl_cents ??
          monthlySummary?.overageUnitAmountBrlCents ??
          status?.usage?.overageUnitAmountBrlCents ??
          0
      };

    status.limits = normalizedLimits;
    status.usage = normalizedUsage;
    status.planDisplayName = commercial?.displayName || status?.planDisplayName || status?.plan || null;
    status.commercial = commercial || status?.commercial || null;
    status.addons = COMMERCIAL_ADDONS;
    status.statusNormalizationMarker = "__AUTOATENDE_R11A_STATUS_NORMALIZATION__";
      status.categoryUsageAuthorityMarker = "__AUTOATENDE_C16N_C3C_BILLING_USAGE_AUTHORITY__";
return res.json({
  ...status,
  commercial: commercial || null,
  commercialAddons: COMMERCIAL_ADDONS || []
});
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) {
      return res.status(503).json({
        error: 'Serviço administrativo de billing temporariamente indisponível.',
        code: error.code,
      });
    }

    console.error('[BillingController] Unexpected error in getStatus:', error);
    return res.status(500).json({ error: 'Failed to fetch billing status' });
  }
}

async function createPortalSession(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const returnUrl = req.body.returnUrl || process.env.FRONTEND_URL || 'https://app.autoatendeai.com.br/billing';
    const sessionUrl = await billingService.createPortalSession(clientId, returnUrl);
    res.json({ url: sessionUrl });
  } catch (error) {
    next(error);
  }
}

async function getMonthlySummary(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());

    const summary = await overageBillingService.getMonthlyUsageSummary(clientId, { month, year });
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function runOverageCycle(req, res, next) {
  try {
    const clientId = req.user?.id || req.user?.clientId;
    const now = new Date();
    const month = Number(req.body.month || now.getMonth() + 1);
    const year = Number(req.body.year || now.getFullYear());
    const dryRun = Boolean(req.body.dryRun);

    const result = await overageBillingService.chargeMonthlyOverage({ clientId, month, year, dryRun });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStatus,
  createPortalSession,
  getMonthlySummary,
  runOverageCycle
};
