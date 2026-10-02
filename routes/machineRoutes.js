const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { authenticateToken, requireRole, requireStrictRole } = require('../middleware/auth');

// Adding/editing/removing machine records is handled by our own team via the device
// server's pairing workflow, not by organization owners.
const canManageMachines = requireRole();

router.get('/machines', authenticateToken, machineController.getMachines);
router.get('/machines/', authenticateToken, machineController.getMachines);
router.post('/machines', authenticateToken, canManageMachines, machineController.createMachine);
router.post('/machines/', authenticateToken, canManageMachines, machineController.createMachine);

router.get('/fleet/summary', authenticateToken, machineController.getFleetSummary);

router.get('/machines/:id', authenticateToken, machineController.getMachineById);

router.put('/machines/:id', authenticateToken, canManageMachines, machineController.updateMachine);
router.delete('/machines/:id', authenticateToken, canManageMachines, machineController.deleteMachine);

// Physical machine control is for field technicians only — no owner, support, or super_admin
// access — and controlMachine further requires a started task for this specific machine.
router.post('/machines/:id/control', authenticateToken, requireStrictRole('field_operations'), machineController.controlMachine);

module.exports = router;
