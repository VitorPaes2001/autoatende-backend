const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

console.log('Health routes loaded');

router.get('/', healthController.check);
router.get('/deep', healthController.deepCheck);

module.exports = router;
