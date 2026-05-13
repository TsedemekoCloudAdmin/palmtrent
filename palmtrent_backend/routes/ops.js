const express = require('express');
const router = express.Router();
const { health, metrics, readiness } = require('../controllers/opsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/health', health);
router.get('/readiness', readiness);
router.get('/metrics', protect, authorize('admin'), metrics);

module.exports = router;
