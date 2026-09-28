const express = require('express');
const router = express.Router();
const firmwareController = require('../controllers/firmwareController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/deployments/history', authenticateToken, requireRole('organization_owner'), firmwareController.getDeploymentHistory);
router.post('/deployments', authenticateToken, requireRole('organization_owner'), firmwareController.createDeployment);

module.exports = router;
