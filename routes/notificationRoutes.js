const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, notificationController.getNotifications);
router.put('/read-all', optionalAuth, notificationController.markAllAsRead);
router.put('/:id/read', optionalAuth, notificationController.markAsRead);

module.exports = router;
