const express = require('express');
const router = express.Router();
const firmwareController = require('../controllers/firmwareController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/deployments/history', authenticateToken, requireRole(), firmwareController.getDeploymentHistory);
router.post('/deployments', authenticateToken, requireRole(), firmwareController.createDeployment);

module.exports = router;
