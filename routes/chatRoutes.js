const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken, requireStrictRole } = require('../middleware/auth');

// Task chat is between a technician and customer support only — no owner, no super_admin bypass.
router.use(authenticateToken, requireStrictRole('field_operations', 'support_refund_agent'));

router.get('/conversations', chatController.getConversations);
router.get('/tasks/:id/messages', chatController.getMessages);
router.post('/tasks/:id/messages', chatController.postMessage);

module.exports = router;
