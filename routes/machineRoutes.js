const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { optionalAuth } = require('../middleware/auth');

router.get('/machines', optionalAuth, machineController.getMachines);
router.get('/machines/', optionalAuth, machineController.getMachines);
router.post('/machines', optionalAuth, machineController.createMachine);
router.post('/machines/', optionalAuth, machineController.createMachine);

router.get('/fleet/summary', optionalAuth, machineController.getFleetSummary);

router.get('/machines/:id', optionalAuth, machineController.getMachineById);

router.put('/machines/:id', optionalAuth, machineController.updateMachine);
router.delete('/machines/:id', optionalAuth, machineController.deleteMachine);

router.post('/machines/:id/start', optionalAuth, machineController.startMachine);
router.post('/machines/:id/stop', optionalAuth, machineController.stopMachine);
router.post('/machines/:id/reboot', optionalAuth, machineController.rebootMachine);
router.post('/machines/:id/relay', optionalAuth, machineController.toggleRelay);

module.exports = router;
