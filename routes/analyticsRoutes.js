const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { optionalAuth } = require('../middleware/auth');

router.get('/summary', optionalAuth, analyticsController.getSummary);
router.get('/daily', optionalAuth, analyticsController.getDaily);
router.get('/machines', optionalAuth, analyticsController.getMachinesAnalytics);
router.get('/export', optionalAuth, analyticsController.exportAnalytics);

module.exports = router;
