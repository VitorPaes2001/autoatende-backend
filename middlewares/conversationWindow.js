const conversationWindowService = require('../services/conversationWindow.service');

module.exports = async function conversationWindowMiddleware(req, res, next) {
  try {
    const companyId =
      req.body.company_id ||
      req.query.company_id ||
      req.params.company_id;

    const phone =
      req.body.phone ||
      req.body.to ||
      req.query.phone;

    if (!companyId || !phone) {
      return res.status(400).json({
        error: 'companyId and phone are required'
      });
    }

    const isOpen = await conversationWindowService.isWindowOpen({
      companyId,
      phone
    });

    if (!isOpen) {
      return res.status(403).json({
        error: 'Conversation window is closed'
      });
    }

    next();
  } catch (err) {
    console.error('conversationWindowMiddleware error:', err);
    res.status(500).json({ error: 'Conversation window validation error' });
  }
};

