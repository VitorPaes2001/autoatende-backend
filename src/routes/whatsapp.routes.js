const express = require('express');
const {
  handleIncomingWhatsAppMessage,
} = require('../services/whatsappMessageHandler');

const router = express.Router();

router.post('/webhook', async (req, res, next) => {
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

module.exports = router;

