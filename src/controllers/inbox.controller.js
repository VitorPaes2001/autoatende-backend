const apiResponse = require('../utils/apiResponse');
const inboxService = require('../services/inbox.service');

async function getConversations(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const conversations = await inboxService.listConversations(companyId, req.query.search);
    return apiResponse.success(res, conversations);
  } catch (err) {
    return next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const messages = await inboxService.listMessages(companyId, req.params.id);
    return apiResponse.success(res, messages);
  } catch (err) {
    return next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const text = String(req.body?.text || req.body?.message || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const result = await inboxService.sendManualMessage({
      companyId,
      clientId: req.company?.client_id,
      conversationId: req.params.id,
      text,
      actorUserId: req.user?.id,
    });

    return apiResponse.success(res, result, 201);
  } catch (err) {
    return next(err);
  }
}

async function assignConversation(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const agentId = req.body?.agent_id || req.body?.user_id;
    if (!agentId) {
      return res.status(400).json({ error: 'Missing agent_id or user_id' });
    }

    const result = await inboxService.assignConversation({
      companyId,
      conversationId: req.params.id,
      agentId,
    });

    return apiResponse.success(res, result);
  } catch (err) {
    return next(err);
  }
}

async function changeMode(req, res, next) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized: Missing company context' });
    }

    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (!mode) {
      return res.status(400).json({ error: 'Missing mode' });
    }

    const result = await inboxService.changeConversationMode({
      companyId,
      conversationId: req.params.id,
      mode,
      agentId: req.body?.agent_id || req.body?.user_id || null,
    });

    return apiResponse.success(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  assignConversation,
  changeMode,
};
