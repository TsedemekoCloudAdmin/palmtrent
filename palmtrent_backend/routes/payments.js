const express = require('express');
const router = express.Router();
const {
  createPayment,
  initiatePaynowPayment,
  confirmCashPayment,
  checkPaymentStatus,
  handlePaynowWebhook,
  getPaymentByReference,
  checkPaymentExpiry,
  initiateAgentPayment,
  verifyAgentPayment,
  handleEcocashAgentWebhook,
  testAgentWebhook,
  // Escrow endpoints
  getEscrowStatus,
  confirmDeliveryForEscrow,
  raiseEscrowDispute,
  cancelAndRefund,
  recordCashCollection,
  adminReleaseFunds,
  adminResolveDispute,
  adminGetEscrowSummary,
  // Withdrawal endpoints
  getTransporterBalance,
  requestWithdrawal,
  getWithdrawalHistory,
  updatePayoutPreferences,
  getPayoutPreferences
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhook routes - no authentication (called by payment providers)
router.post('/webhook', handlePaynowWebhook);
router.post('/resulturl', handlePaynowWebhook);

// EcoCash Agent webhook - called by EcoCash when cash is deposited
router.post('/ecocash-agent/webhook', handleEcocashAgentWebhook);
router.get('/ecocash-agent/webhook', testAgentWebhook); // Health check

// All other routes require authentication
router.use(protect);

// Create payment record
router.post('/create', createPayment);

// Initiate Paynow payment
router.post('/initiate-paynow', initiatePaynowPayment);
router.post('/initiate-openapi', initiatePaynowPayment);

// Confirm cash payment (agent, pickup, delivery)
router.post('/confirm-cash', confirmCashPayment);

// EcoCash Agent payment routes
router.post('/initiate-agent', initiateAgentPayment);
router.post('/verify-agent', verifyAgentPayment);

// Check payment status
router.get('/status/:paymentReference', checkPaymentStatus);

// Check payment expiry
router.get('/expiry/:paymentReference', checkPaymentExpiry);

// ============ ESCROW ROUTES ============

// Get escrow status for a booking
router.get('/escrow/booking/:bookingId', getEscrowStatus);

// Confirm delivery (starts grace period)
router.post('/escrow/confirm-delivery/:bookingId', confirmDeliveryForEscrow);

// Raise dispute on escrow
router.post('/escrow/dispute/:bookingId', raiseEscrowDispute);

// Cancel booking and refund (before transporter match)
router.post('/escrow/cancel/:bookingId', cancelAndRefund);

// Record cash collection by transporter
router.post('/escrow/cash-collection/:bookingId', recordCashCollection);

// Admin routes
router.post('/escrow/admin/release/:escrowId', adminReleaseFunds);
router.post('/escrow/admin/resolve-dispute/:escrowId', adminResolveDispute);
router.get('/escrow/admin/summary', adminGetEscrowSummary);

// ============ WITHDRAWAL ROUTES ============

// Get transporter balance (available for withdrawal)
router.get('/withdrawal/balance', getTransporterBalance);

// Request withdrawal
router.post('/withdrawal/request', requestWithdrawal);

// Get withdrawal history
router.get('/withdrawal/history', getWithdrawalHistory);

// Payout preferences
router.get('/payout-preferences', getPayoutPreferences);
router.put('/payout-preferences', updatePayoutPreferences);

// Get payment by reference - keep this last so it does not shadow static routes
router.get('/:reference', getPaymentByReference);

module.exports = router;
