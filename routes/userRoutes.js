const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('organization_owner', 'support_refund_agent'), userController.getUsers);
router.post('/', authenticateToken, requireRole('organization_owner'), userController.createUser);
router.put('/:id', authenticateToken, requireRole('organization_owner'), userController.updateUser);
router.delete('/:id', authenticateToken, requireRole('organization_owner'), userController.deleteUser);

module.exports = router;
