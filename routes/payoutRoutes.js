const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Same people who can see revenue (owners and finance auditors; a super admin always can)
const canViewPayouts = requireRole('organization_owner', 'finance_auditor');

router.get('/', authenticateToken, canViewPayouts, payoutController.getPayouts);
router.get('/export', authenticateToken, canViewPayouts, payoutController.exportPayouts);

module.exports = router;
