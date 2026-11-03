const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('organization_owner', 'support_refund_agent'), userController.getUsers);
router.post('/', authenticateToken, requireRole(), userController.createUser);
router.get('/:id/machines', authenticateToken, requireRole('organization_owner'), userController.getUserMachines);
router.put('/:id/machines', authenticateToken, requireRole('organization_owner'), userController.setUserMachines);
router.put('/:id', authenticateToken, requireRole(), userController.updateUser);
router.delete('/:id', authenticateToken, requireRole(), userController.deleteUser);

module.exports = router;
