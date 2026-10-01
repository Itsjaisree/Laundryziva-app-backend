const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const machineController = require('../controllers/machineController');
const { requireDeviceServerKey } = require('../middleware/internalAuth');

// Server-to-server endpoints for the device server's pairing dashboard — not reachable
// by the mobile app, which uses the normal JWT-protected routes.
router.get('/organizations', requireDeviceServerKey, organizationController.getOrganizations);
router.post('/machines', requireDeviceServerKey, machineController.createMachine);

module.exports = router;
