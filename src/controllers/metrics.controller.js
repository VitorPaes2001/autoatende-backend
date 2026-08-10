const metricsService = require('../services/metrics.service');

// __AUTOATENDE_C10E_R3_METRICS_COMPANY_CONTEXT_RESOLUTION__
const companyService = require('../services/company.service');const apiResponse = require('../utils/apiResponse');



async function resolveMetricsCompanyId(req) {
  const directCandidates = [
    req?.companyId,
    req?.company_id,
    req?.company?.id,
    req?.user?.companyId,
    req?.user?.company_id,
    req?.user?.company?.id,
    req?.user?.user_metadata?.company_id,
    req?.user?.app_metadata?.company_id,
    req?.auth?.companyId,
    req?.auth?.company_id,
    req?.profile?.company_id
  ].filter(Boolean);

  if (directCandidates.length > 0) {
    return String(directCandidates[0]);
  }

  const clientCandidates = [
    req?.clientId,
    req?.client_id,
    req?.user?.clientId,
    req?.user?.client_id,
    req?.user?.user_metadata?.client_id,
    req?.user?.app_metadata?.client_id,
    req?.auth?.clientId,
    req?.auth?.client_id,
    req?.profile?.client_id
  ].filter(Boolean);

  if (clientCandidates.length > 0) {
    const company = await companyService.getCompanyByClientId(String(clientCandidates[0]));
    if (company?.id) {
      return String(company.id);
    }
  }

  return null;
}
/**
 * Controller de Métricas
 */

const getOverview = async (req, res, next) => {
  try {
    // 🔒 Security: CompanyId comes from Auth Middleware
    const companyId = await resolveMetricsCompanyId(req); 

    if (!companyId) {
      console.error('[Metrics] Missing company context', {
        reqCompanyId: req?.companyId || null,
        reqCompany_id: req?.company_id || null,
        userCompanyId: req?.user?.companyId || null,
        userCompany_id: req?.user?.company_id || null,
        userClientId: req?.user?.clientId || null,
        userClient_id: req?.user?.client_id || null
      });
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const data = await metricsService.getCompanyOverview(companyId);
    return apiResponse.success(res, data);
  } catch (err) {
    console.error('[Metrics] Error fetching overview, returning fallback:', err);
    // Fallback silencioso para não quebrar o dashboard
    return apiResponse.success(res, {
      financial: { status: 'none', plan: 'none' },
      usage: {
        conversations: { total: 0, used: 0, remaining: 0 },
        templates: { total: 0, used: 0, remaining: 0 }
      },
      attendance: { bot: 0, human: 0, total_tracked: 0, bot_percent: 0, human_percent: 0 }
    });
  }
};

const getTemporal = async (req, res, next) => {
  try {
    // 🔒 Security: CompanyId comes from Auth Middleware
    const companyId = await resolveMetricsCompanyId(req);
    const { days } = req.query;

    if (!companyId) {
      console.error('[Metrics] Missing company context', {
        reqCompanyId: req?.companyId || null,
        reqCompany_id: req?.company_id || null,
        userCompanyId: req?.user?.companyId || null,
        userCompany_id: req?.user?.company_id || null,
        userClientId: req?.user?.clientId || null,
        userClient_id: req?.user?.client_id || null
      });
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const period = days ? parseInt(days) : 30;
    const data = await metricsService.getDailyVolume(companyId, period);
    return apiResponse.success(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverview,
  getTemporal
};
