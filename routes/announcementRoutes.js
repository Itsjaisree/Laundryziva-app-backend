const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementController');
const { authenticateToken, requireStrictRole } = require('../middleware/auth');

// Platform-wide messages: super admin only.
router.use(authenticateToken, requireStrictRole('super_admin'));
router.get('/preview', controller.preview);
router.get('/', controller.history);
router.post('/', controller.send);

module.exports = router;
