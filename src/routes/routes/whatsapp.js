const express = require('express');
const { handleIncomingWhatsAppMessage } = require('../services/whatsappMessageHandler');
const enforceUsage = require('../../middlewares/usage.middleware');

const router = express.Router();

/**
 * Endpoint técnico (send)
 */
router.post('/send', enforceUsage, async (req, res) => {
  try {
    await handleIncomingWhatsAppMessage({
      company_id: req.body.company_id,
      from: req.body.to, // Note: In outbound 'send', 'from' in payload is usually the sender (company), but handler expects 'from' as user?
                         // Wait, handleIncomingWhatsAppMessage is for INBOUND.
                         // Why is /send calling handleIncomingWhatsAppMessage?
                         // It constructs payload: { from: req.body.to } -> this means the user is 'to'.
                         // This seems to simulate an inbound message or it's misnamed?
                         // The existing code says: from: req.body.to
                         // If I send TO a user, the user is the contact.
                         // handleIncomingWhatsAppMessage expects 'from' to be the contact.
                         // So this maps correctly for the handler.
                         // But enforceUsage expects 'req.body.from' or 'req.body.to'.
                         // In /send, we have req.body.to. Middleware uses it as contact.
                         // Type defaults to 'message'.
                         // Correct.
      message: req.body.message
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[SEND ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Webhook WhatsApp (INBOUND)
 */
router.post('/webhook', enforceUsage, async (req, res) => {
  try {
    await handleIncomingWhatsAppMessage(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;

