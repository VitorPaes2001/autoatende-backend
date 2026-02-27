const express = require('express');
const inboxController = require('../controllers/inbox.controller');

const router = express.Router();

router.get('/conversations', inboxController.getConversations);
router.get('/conversations/:id/messages', inboxController.getMessages);
router.post('/conversations/:id/messages', inboxController.sendMessage);
router.post('/conversations/:id/assign', inboxController.assignConversation);
router.post('/conversations/:id/mode', inboxController.changeMode);

module.exports = router;
