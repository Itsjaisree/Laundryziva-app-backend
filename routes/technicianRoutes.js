const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const { authenticateToken } = require('../middleware/auth');

router.get('/tasks', authenticateToken, technicianController.getTasks);
router.get('/tasks/:id', authenticateToken, technicianController.getTask);
router.post('/tasks', authenticateToken, technicianController.createTask);
router.post('/tasks/:id/start', authenticateToken, technicianController.startTask);
router.post('/tasks/:id/complete', authenticateToken, technicianController.completeTask);
router.post('/tasks/:id/photos', authenticateToken, technicianController.updateTaskPhotos);
router.post('/tasks/:id/change-request', authenticateToken, technicianController.requestTaskChange);
router.get('/tasks/:id/messages', authenticateToken, technicianController.getTaskMessages);
router.post('/tasks/:id/messages', authenticateToken, technicianController.postTaskMessage);

module.exports = router;
