const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, transactionController.getTransactions);
router.get('/export', authenticateToken, transactionController.exportTransactions);
router.post('/', authenticateToken, transactionController.createTransaction);
router.post('/:id/refund', authenticateToken, transactionController.refundTransaction);

module.exports = router;
