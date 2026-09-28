const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { authenticateToken } = require('../middleware/auth');

router.get('/machines', authenticateToken, machineController.getMachines);
router.get('/machines/', authenticateToken, machineController.getMachines);
router.post('/machines', authenticateToken, machineController.createMachine);
router.post('/machines/', authenticateToken, machineController.createMachine);

router.get('/fleet/summary', authenticateToken, machineController.getFleetSummary);

router.get('/machines/:id', authenticateToken, machineController.getMachineById);

router.put('/machines/:id', authenticateToken, machineController.updateMachine);
router.delete('/machines/:id', authenticateToken, machineController.deleteMachine);

router.post('/machines/:id/start', authenticateToken, machineController.startMachine);
router.post('/machines/:id/stop', authenticateToken, machineController.stopMachine);
router.post('/machines/:id/reboot', authenticateToken, machineController.rebootMachine);
router.post('/machines/:id/relay', authenticateToken, machineController.toggleRelay);

module.exports = router;
