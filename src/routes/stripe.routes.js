const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');

// Note: Body parsing needs to be raw for this route. 
// Handled in app.js or specific middleware here if possible?
// If app.js already parsed it, we are stuck.
// We will handle the parsing adjustment in app.js.

router.post('/webhook', stripeController.webhook);

module.exports = router;
