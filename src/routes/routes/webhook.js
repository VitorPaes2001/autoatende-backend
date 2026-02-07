const express = require('express');
const router = express.Router();
const { handleIncomingWhatsAppMessage } = require('../services/whatsappMessageHandler');

// GET — verificação
router.get('/', (req, res) => {
  console.log('WEBHOOK GET RECEBIDO', req.query);

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// POST — qualquer payload
router.post('/', async (req, res) => {
  console.log('WEBHOOK POST RECEBIDO');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('Nenhuma mensagem encontrada no payload');
      return res.sendStatus(200);
    }

    if (message.type !== 'text') {
      console.log('Mensagem não é texto');
      return res.sendStatus(200);
    }

    const payload = {
      company_id: 1,
      whatsapp_account_id: value.metadata.phone_number_id,
      from: message.from,
      to: value.metadata.display_phone_number,
      message: message.text.body
    };

    await handleIncomingWhatsAppMessage(payload);

    return res.sendStatus(200);
  } catch (err) {
    console.error('ERRO NO WEBHOOK', err);
    return res.sendStatus(500);
  }
});

module.exports = router;
