const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const canViewTransactions = requireRole('organization_owner', 'finance_auditor', 'support_refund_agent');
const canRefund = requireRole('organization_owner', 'finance_auditor', 'support_refund_agent');

router.get('/', authenticateToken, canViewTransactions, transactionController.getTransactions);
router.get('/export', authenticateToken, canViewTransactions, transactionController.exportTransactions);
router.post('/', authenticateToken, requireRole('organization_owner'), transactionController.createTransaction);
router.post('/:id/refund', authenticateToken, canRefund, transactionController.refundTransaction);

module.exports = router;
