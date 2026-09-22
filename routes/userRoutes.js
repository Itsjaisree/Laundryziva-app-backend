const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, userController.getUsers);
router.post('/', optionalAuth, userController.createUser);
router.put('/:id', optionalAuth, userController.updateUser);
router.delete('/:id', optionalAuth, userController.deleteUser);

module.exports = router;
