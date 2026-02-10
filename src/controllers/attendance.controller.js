const attendanceService = require('../services/attendance.service');
const apiResponse = require('../utils/apiResponse');

/**
 * Controller de Atendimento
 */

// POST /transfer/human
const transferToHuman = async (req, res, next) => {
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
