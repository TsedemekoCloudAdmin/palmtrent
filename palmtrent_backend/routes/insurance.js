const express = require('express');
const router = express.Router();
const { issuePolicy, renewPolicy, getMyPolicies } = require('../controllers/insuranceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/policies', getMyPolicies);
router.post('/policies/issue', issuePolicy);
router.post('/policies/:id/renew', renewPolicy);

module.exports = router;
