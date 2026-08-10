const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');

router.post('/webhook', stripeController.handleWebhook);

module.exports = router;
