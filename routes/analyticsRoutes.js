const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const canViewAnalytics = requireRole('organization_owner', 'finance_auditor');

router.get('/summary', authenticateToken, canViewAnalytics, analyticsController.getSummary);
router.get('/daily', authenticateToken, canViewAnalytics, analyticsController.getDaily);
router.get('/machines', authenticateToken, canViewAnalytics, analyticsController.getMachinesAnalytics);
router.get('/export', authenticateToken, canViewAnalytics, analyticsController.exportAnalytics);

module.exports = router;
