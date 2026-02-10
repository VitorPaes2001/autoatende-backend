const express = require('express');
const {
  handleIncomingWhatsAppMessage,
} = require('../services/whatsappMessageHandler');
const enforceUsage = require('../middlewares/usage.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const whatsappController = require('../controllers/whatsapp.controller');

const router = express.Router();

// Public Webhook (WhatsApp Cloud API calls this)
router.post('/webhook', enforceUsage, async (req, res, next) => {
  try {
    const result = await handleIncomingWhatsAppMessage(req.body);

    if (result.blocked) {
      return res.status(403).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// Private Configuration Routes (Frontend calls these)
router.post('/connect', authMiddleware, whatsappController.connect);
router.get('/status', authMiddleware, whatsappController.getStatus);

module.exports = router;
