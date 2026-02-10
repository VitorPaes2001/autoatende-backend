const metricsService = require('../services/metrics.service');
const apiResponse = require('../utils/apiResponse');

/**
 * Controller de Métricas
 */

const getOverview = async (req, res, next) => {
  try {
    // 🔒 Security: CompanyId comes from Auth Middleware
    const companyId = req.companyId; 

    if (!companyId) {
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
    const companyId = req.companyId;
    const { days } = req.query;

    if (!companyId) {
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
