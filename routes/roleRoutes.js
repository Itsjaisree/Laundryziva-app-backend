const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('organization_owner'), roleController.getRoles);
router.post('/', authenticateToken, requireRole('organization_owner'), roleController.createRole);
router.delete('/:id', authenticateToken, requireRole('organization_owner'), roleController.deleteRole);

router.get('/:id/permissions', authenticateToken, requireRole('organization_owner'), roleController.getRolePermissions);
router.put('/:id/permissions', authenticateToken, requireRole('organization_owner'), roleController.updateRolePermissions);

router.get('/:id/notification-types', authenticateToken, requireRole('organization_owner'), roleController.getRoleNotificationTypes);
router.put('/:id/notification-types', authenticateToken, requireRole('organization_owner'), roleController.updateRoleNotificationTypes);

module.exports = router;
