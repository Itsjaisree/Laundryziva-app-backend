const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const canWorkOnTasks = requireRole('organization_owner', 'field_operations');

router.get('/tasks', authenticateToken, canWorkOnTasks, technicianController.getTasks);
router.get('/tasks/:id', authenticateToken, canWorkOnTasks, technicianController.getTask);
router.post('/tasks', authenticateToken, requireRole('organization_owner', 'support_refund_agent'), technicianController.createTask);
router.post('/tasks/:id/start', authenticateToken, canWorkOnTasks, technicianController.startTask);
router.post('/tasks/:id/complete', authenticateToken, canWorkOnTasks, technicianController.completeTask);
router.post('/tasks/:id/photos', authenticateToken, canWorkOnTasks, technicianController.updateTaskPhotos);
router.post('/tasks/:id/change-request', authenticateToken, canWorkOnTasks, technicianController.requestTaskChange);
router.get('/tasks/:id/messages', authenticateToken, canWorkOnTasks, technicianController.getTaskMessages);
router.post('/tasks/:id/messages', authenticateToken, canWorkOnTasks, technicianController.postTaskMessage);

module.exports = router;
