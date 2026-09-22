const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, roleController.getRoles);
router.post('/', optionalAuth, roleController.createRole);
router.delete('/:id', optionalAuth, roleController.deleteRole);

router.get('/:id/permissions', optionalAuth, roleController.getRolePermissions);
router.put('/:id/permissions', optionalAuth, roleController.updateRolePermissions);

router.get('/:id/notification-types', optionalAuth, roleController.getRoleNotificationTypes);
router.put('/:id/notification-types', optionalAuth, roleController.updateRoleNotificationTypes);

module.exports = router;
