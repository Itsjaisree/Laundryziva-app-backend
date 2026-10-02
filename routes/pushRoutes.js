const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', authenticateToken, pushController.register);
router.post('/unregister', authenticateToken, pushController.unregister);

router.get('/prefs', authenticateToken, pushController.getPrefs);
router.put('/prefs', authenticateToken, pushController.setPrefs);

module.exports = router;
