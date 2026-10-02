const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const machineController = require('../controllers/machineController');
const { ingestPayment } = require('../controllers/internalPaymentController');
const { requireDeviceServerKey } = require('../middleware/internalAuth');

// Server-to-server endpoints for the device server's pairing dashboard — not reachable
// by the mobile app, which uses the normal JWT-protected routes.
router.get('/organizations', requireDeviceServerKey, organizationController.getOrganizations);
router.post('/organizations', requireDeviceServerKey, organizationController.createOrganization);
router.post('/machines', requireDeviceServerKey, machineController.registerPairedMachine);
router.post('/payments', requireDeviceServerKey, ingestPayment);

module.exports = router;
