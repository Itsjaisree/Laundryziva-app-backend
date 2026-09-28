const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('organization_owner'), organizationController.getOrganizations);
router.post('/', authenticateToken, requireRole(), organizationController.createOrganization);
router.delete('/:id', authenticateToken, requireRole(), organizationController.deleteOrganization);

module.exports = router;
