const express = require('express');
const { handleIncomingWhatsAppMessage } = require('../services/whatsappMessageHandler');

const router = express.Router();

/**
 * Endpoint técnico (send)
 */
router.post('/send', async (req, res) => {
  try {
    await handleIncomingWhatsAppMessage({
      company_id: req.body.company_id,
      from: req.body.to,
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
router.post('/webhook', async (req, res) => {
  try {
    await handleIncomingWhatsAppMessage(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;

