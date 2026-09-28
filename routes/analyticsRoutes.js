const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/summary', authenticateToken, analyticsController.getSummary);
router.get('/daily', authenticateToken, analyticsController.getDaily);
router.get('/machines', authenticateToken, analyticsController.getMachinesAnalytics);
router.get('/export', authenticateToken, analyticsController.exportAnalytics);

module.exports = router;
