const express = require('express');
const router = express.Router();
const firmwareController = require('../controllers/firmwareController');
const { authenticateToken } = require('../middleware/auth');

router.get('/deployments/history', authenticateToken, firmwareController.getDeploymentHistory);
router.post('/deployments', authenticateToken, firmwareController.createDeployment);

module.exports = router;
