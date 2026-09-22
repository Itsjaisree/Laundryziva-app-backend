const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, transactionController.getTransactions);
router.get('/export', optionalAuth, transactionController.exportTransactions);
router.post('/', optionalAuth, transactionController.createTransaction);
router.post('/:id/refund', optionalAuth, transactionController.refundTransaction);

module.exports = router;
