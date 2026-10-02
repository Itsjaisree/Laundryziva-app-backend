const express = require('express');
const router = express.Router();
const customerCareController = require('../controllers/customerCareController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Organization Owner can see ticket status (view_service_logs: 'view') but cannot
// raise/resolve/reassign — only support_refund_agent manages the ticket lifecycle.
const canViewTickets = requireRole('organization_owner', 'support_refund_agent');
const canManageTickets = requireRole('support_refund_agent');

router.get('/tickets', authenticateToken, canViewTickets, customerCareController.getTickets);
router.post('/tickets', authenticateToken, canManageTickets, customerCareController.createTicket);
router.get('/tickets/customer/:customerId', authenticateToken, canViewTickets, customerCareController.getCustomerHistory);
router.get('/tickets/:id', authenticateToken, canViewTickets, customerCareController.getTicket);
router.post('/tickets/:id/reassign', authenticateToken, canManageTickets, customerCareController.reassignTicket);
router.post('/tickets/:id/resolve', authenticateToken, canManageTickets, customerCareController.resolveTicket);
router.post('/tickets/:id/take-ownership', authenticateToken, canManageTickets, customerCareController.takeOwnershipTicket);

module.exports = router;
