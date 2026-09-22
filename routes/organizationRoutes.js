const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, organizationController.getOrganizations);
router.post('/', optionalAuth, organizationController.createOrganization);
router.delete('/:id', optionalAuth, organizationController.deleteOrganization);

module.exports = router;
