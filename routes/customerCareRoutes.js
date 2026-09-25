const express = require('express');
const router = express.Router();
const customerCareController = require('../controllers/customerCareController');
const { optionalAuth } = require('../middleware/auth');

router.get('/tickets', optionalAuth, customerCareController.getTickets);
router.post('/tickets', optionalAuth, customerCareController.createTicket);
router.post('/tickets/:id/reassign', optionalAuth, customerCareController.reassignTicket);
router.post('/tickets/:id/resolve', optionalAuth, customerCareController.resolveTicket);

module.exports = router;
