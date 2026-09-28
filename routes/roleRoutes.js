const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, roleController.getRoles);
router.post('/', authenticateToken, roleController.createRole);
router.delete('/:id', authenticateToken, roleController.deleteRole);

router.get('/:id/permissions', authenticateToken, roleController.getRolePermissions);
router.put('/:id/permissions', authenticateToken, roleController.updateRolePermissions);

router.get('/:id/notification-types', authenticateToken, roleController.getRoleNotificationTypes);
router.put('/:id/notification-types', authenticateToken, roleController.updateRoleNotificationTypes);

module.exports = router;
