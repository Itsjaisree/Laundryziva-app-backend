const express = require('express');
const router = express.Router();
const firmwareController = require('../controllers/firmwareController');
const { optionalAuth } = require('../middleware/auth');

router.get('/deployments/history', optionalAuth, firmwareController.getDeploymentHistory);
router.post('/deployments', optionalAuth, firmwareController.createDeployment);

module.exports = router;
