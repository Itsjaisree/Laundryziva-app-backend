const express = require('express');
const router = express.Router();
const customerCareController = require('../controllers/customerCareController');
const { authenticateToken } = require('../middleware/auth');

router.get('/tickets', authenticateToken, customerCareController.getTickets);
router.post('/tickets', authenticateToken, customerCareController.createTicket);
router.get('/tickets/customer/:customerId', authenticateToken, customerCareController.getCustomerHistory);
router.get('/tickets/:id', authenticateToken, customerCareController.getTicket);
router.post('/tickets/:id/reassign', authenticateToken, customerCareController.reassignTicket);
router.post('/tickets/:id/resolve', authenticateToken, customerCareController.resolveTicket);
router.post('/tickets/:id/take-ownership', authenticateToken, customerCareController.takeOwnershipTicket);

module.exports = router;
