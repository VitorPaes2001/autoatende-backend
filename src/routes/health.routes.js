const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

router.get('/', healthController.check);
router.get('/deep', healthController.deepCheck);

module.exports = router;
