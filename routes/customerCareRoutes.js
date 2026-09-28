const express = require('express');
const router = express.Router();
const customerCareController = require('../controllers/customerCareController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const canManageTickets = requireRole('organization_owner', 'support_refund_agent');

router.get('/tickets', authenticateToken, canManageTickets, customerCareController.getTickets);
router.post('/tickets', authenticateToken, canManageTickets, customerCareController.createTicket);
router.get('/tickets/customer/:customerId', authenticateToken, canManageTickets, customerCareController.getCustomerHistory);
router.get('/tickets/:id', authenticateToken, canManageTickets, customerCareController.getTicket);
router.post('/tickets/:id/reassign', authenticateToken, canManageTickets, customerCareController.reassignTicket);
router.post('/tickets/:id/resolve', authenticateToken, canManageTickets, customerCareController.resolveTicket);
router.post('/tickets/:id/take-ownership', authenticateToken, canManageTickets, customerCareController.takeOwnershipTicket);

module.exports = router;
