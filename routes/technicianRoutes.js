const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const technicianController = require('../controllers/technicianController');
const { authenticateToken, requireRole, requireStrictRole } = require('../middleware/auth');

const canWorkOnTasks = requireRole('organization_owner', 'field_operations');
// Support creates tasks, so they must be able to see them (read-only) too.
const canViewTasks = requireRole('organization_owner', 'field_operations', 'support_refund_agent');

router.get('/tasks', authenticateToken, canViewTasks, technicianController.getTasks);
router.get('/tasks/:id', authenticateToken, canViewTasks, technicianController.getTask);
router.post('/tasks', authenticateToken, requireRole('organization_owner', 'support_refund_agent'), technicianController.createTask);
router.put('/tasks/:id', authenticateToken, requireRole('support_refund_agent'), technicianController.updateTask);
router.post('/tasks/:id/start', authenticateToken, canWorkOnTasks, technicianController.startTask);
router.post('/tasks/:id/complete', authenticateToken, canWorkOnTasks, technicianController.completeTask);
// Raw image body (no multipart). Only the task's own technician can upload evidence.
router.post('/tasks/:id/photo', authenticateToken, requireStrictRole('field_operations'), express.raw({ type: ['image/jpeg', 'image/png'], limit: '8mb' }), photoController.uploadTaskPhoto);
router.post('/tasks/:id/change-request', authenticateToken, canWorkOnTasks, technicianController.requestTaskChange);

module.exports = router;
