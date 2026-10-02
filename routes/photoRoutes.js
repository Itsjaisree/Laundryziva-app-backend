const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');

// Photos are never served statically; every view is authorized against the task they belong to.
router.get('/:id', authenticateToken, photoController.getPhoto);

module.exports = router;
