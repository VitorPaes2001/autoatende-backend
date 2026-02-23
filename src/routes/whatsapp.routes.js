const express = require('express');
const {
  handleIncomingWhatsAppMessage,
} = require('../services/whatsappMessageHandler');
const authMiddleware = require('../middlewares/auth.middleware');
const whatsappController = require('../controllers/whatsapp.controller');

const router = express.Router();

// Public Webhook Verification (WhatsApp GET challenge)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Public Webhook Receiver (WhatsApp Cloud API calls this)
// IMPORTANT: never return 4xx/5xx for business logic blocks, always ACK 200.
router.post('/webhook', (req, res) => {
  const payload = req.body;

  // ACK imediato: evita retry storm do provedor
  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      await handleIncomingWhatsAppMessage(payload);
    } catch (err) {
      console.error('[WhatsApp Webhook] processing failed:', err?.message || err);
    }
  });
});

// Private Configuration Routes (Frontend calls these)
router.post('/connect', authMiddleware, whatsappController.connect);
router.get('/status', authMiddleware, whatsappController.getStatus);

module.exports = router;
