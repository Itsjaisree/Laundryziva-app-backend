const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, organizationController.getOrganizations);
router.post('/', authenticateToken, organizationController.createOrganization);
router.delete('/:id', authenticateToken, organizationController.deleteOrganization);

module.exports = router;
