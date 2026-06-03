const express = require('express');
const {
  getLandingSummary,
  getPublicPlans,
  createMySubscription,
  createSubscriptionPayment,
  getMySubscription
} = require('../controllers/publicController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/landing', getLandingSummary);
router.get('/plans', getPublicPlans);
router.get('/subscriptions/me', protect, getMySubscription);
router.post('/subscriptions', protect, createMySubscription);
router.post('/subscriptions/:id/payment', protect, createSubscriptionPayment);

module.exports = router;
