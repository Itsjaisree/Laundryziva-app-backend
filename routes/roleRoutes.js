const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole(), roleController.getRoles);
router.post('/', authenticateToken, requireRole(), roleController.createRole);
router.delete('/:id', authenticateToken, requireRole(), roleController.deleteRole);

router.get('/:id/permissions', authenticateToken, requireRole(), roleController.getRolePermissions);
router.put('/:id/permissions', authenticateToken, requireRole(), roleController.updateRolePermissions);

router.get('/:id/notification-types', authenticateToken, requireRole(), roleController.getRoleNotificationTypes);
router.put('/:id/notification-types', authenticateToken, requireRole(), roleController.updateRoleNotificationTypes);

module.exports = router;
