const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const canControlMachines = requireRole('organization_owner', 'field_operations');
// Adding/editing/removing machine records is handled by our own team via the device
// server's pairing workflow, not by organization owners — they get read + operational
// control (start/stop/relay) on their fleet, but not record management.
const canManageMachines = requireRole();

router.get('/machines', authenticateToken, machineController.getMachines);
router.get('/machines/', authenticateToken, machineController.getMachines);
router.post('/machines', authenticateToken, canManageMachines, machineController.createMachine);
router.post('/machines/', authenticateToken, canManageMachines, machineController.createMachine);

router.get('/fleet/summary', authenticateToken, machineController.getFleetSummary);

router.get('/machines/:id', authenticateToken, machineController.getMachineById);

router.put('/machines/:id', authenticateToken, canManageMachines, machineController.updateMachine);
router.delete('/machines/:id', authenticateToken, canManageMachines, machineController.deleteMachine);

router.post('/machines/:id/start', authenticateToken, canControlMachines, machineController.startMachine);
router.post('/machines/:id/stop', authenticateToken, canControlMachines, machineController.stopMachine);
router.post('/machines/:id/reboot', authenticateToken, canControlMachines, machineController.rebootMachine);
router.post('/machines/:id/relay', authenticateToken, canControlMachines, machineController.toggleRelay);

module.exports = router;
