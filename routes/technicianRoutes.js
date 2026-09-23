const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const { optionalAuth } = require('../middleware/auth');

router.get('/tasks', optionalAuth, technicianController.getTasks);
router.get('/tasks/:id', optionalAuth, technicianController.getTask);
router.post('/tasks', optionalAuth, technicianController.createTask);
router.post('/tasks/:id/start', optionalAuth, technicianController.startTask);
router.post('/tasks/:id/complete', optionalAuth, technicianController.completeTask);
router.post('/tasks/:id/change-request', optionalAuth, technicianController.requestTaskChange);
router.get('/tasks/:id/messages', optionalAuth, technicianController.getTaskMessages);
router.post('/tasks/:id/messages', optionalAuth, technicianController.postTaskMessage);

module.exports = router;
