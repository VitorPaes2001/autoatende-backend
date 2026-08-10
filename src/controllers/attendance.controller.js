const attendanceService = require('../services/attendance.service');
const apiResponse = require('../utils/apiResponse');
const { safeErrorFields, safeLogFields } = require('../security/telemetrySanitizer');
const safeLogger = require('../security/safeLogger');


/* __AUTOATENDE_C4A2A_OWNER_BIND__ */
function resolveAuthenticatedUserId(req) {
  return (
    req?.user?.id ||
    req?.userId ||
    req?.auth?.userId ||
    req?.auth?.id ||
    null
  );
}

function bindAuthenticatedOwnerOnBody(req) {
  const authenticatedUserId = resolveAuthenticatedUserId(req);
  if (!authenticatedUserId) return null;

  req.body = { ...(req.body || {}) };

  const shouldBindAuthenticatedOwner =
    !req.body.agent_id ||
    req.body.agent_id === 'agent_default' ||
    req.body.agent_id === 'authenticated_user';

  if (!shouldBindAuthenticatedOwner) {
    return authenticatedUserId;
  }

  req.body.assigned_user_id =
    req.body.assigned_user_id ||
    req.body.user_id ||
    req.body.owner_user_id ||
    authenticatedUserId;

  req.body.agent_id = authenticatedUserId;

  return authenticatedUserId;
}

/**
 * Controller de Atendimento
 */

// POST /transfer/human
const transferToHuman = async (req, res, next) => {
  // __AUTOATENDE_C4A2A_ATTENDANCE_transferToHuman__
  const authenticatedUserId = bindAuthenticatedOwnerOnBody(req);
  try {
    const { contact, agent_id } = req.body;
    // 🔒 Security: CompanyId comes from Auth Middleware
    const company_id = req.companyId;

    if (!company_id) {
       return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }
    if (!contact) {
      return res.status(400).json({ error: 'Missing contact' });
    }

    const result = await attendanceService.transferToHuman(company_id, contact, agent_id);
    return apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
};

// POST /transfer/agent
const transferToAgent = async (req, res, next) => {
  // __AUTOATENDE_C4A2A_ATTENDANCE_transferToAgent__
  const authenticatedUserId = bindAuthenticatedOwnerOnBody(req);
  try {
    const { contact, agent_id } = req.body;
    // 🔒 Security: CompanyId comes from Auth Middleware
    const company_id = req.companyId;

    if (!company_id) {
       return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }
    if (!contact || !agent_id) {
      return res.status(400).json({ error: 'Missing contact or agent_id' });
    }

    const result = await attendanceService.transferToAgent(company_id, contact, agent_id);
    return apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
};

// POST /return/bot
const returnToBot = async (req, res, next) => {
  try {
    const { contact } = req.body;
    // 🔒 Security: CompanyId comes from Auth Middleware
    const company_id = req.companyId;

    if (!company_id) {
       return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }
    if (!contact) {
      return res.status(400).json({ error: 'Missing contact' });
    }

    const result = await attendanceService.returnToBot(company_id, contact);
    return apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
};

// GET /state
const getState = async (req, res, next) => {
  try {
    const { contact } = req.query;
    // 🔒 Security: CompanyId comes from Auth Middleware
    const companyId = req.companyId;

    if (!companyId) {
       return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }
    if (!contact) {
      return res.status(400).json({ error: 'Missing contact' });
    }

    const state = await attendanceService.getConversationState(companyId, contact);
    return apiResponse.success(res, state);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  transferToHuman,
  transferToAgent,
  returnToBot,
  getState
};


/* __AUTOATENDE_C7E_R3_OBS_CONTROLLER_RETURN_TO_BOT__ */
if (typeof module.exports.returnToBot === 'function') {
  const __c7eR3ObsPrevControllerReturnToBot = module.exports.returnToBot;

  module.exports.returnToBot = async function c7eR3ObsControllerReturnToBot(req, res, next) {
    try {
      safeLogger.log('[C7E_R3_OBS] controller.returnToBot request', safeLogFields({
        company_id: req?.company_id || req?.user?.company_id,
        contact: req?.body?.contact || req?.query?.contact,
        status: 'received',
      }));
    } catch (err) {
      safeLogger.warn('[C7E_R3_OBS] controller.returnToBot request log failed', safeErrorFields(err));
    }

    return __c7eR3ObsPrevControllerReturnToBot(req, res, next);
  };
}
