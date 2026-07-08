const express = require('express');
const router = express.Router();
const {
  getPayments,
  createPayment,
  initiatePayment,
  confirmCashPayment,
  checkPaymentStatus,
  handlePaynowWebhook,
  getPaymentByReference,
  getProofOfPayment,
  checkPaymentExpiry,
  initiateAgentPayment,
  verifyAgentPayment,
  handleEcocashAgentWebhook,
  testAgentWebhook,
  reconcileEcocashAgentPayments,
  // Escrow endpoints
  getEscrowStatus,
  confirmDeliveryForEscrow,
  raiseEscrowDispute,
  cancelAndRefund,
  recordCashCollection,
  adminReleaseFunds,
  adminProcessScheduledReleases,
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

// Paynow mobile-money webhook routes - no authentication (called by provider).
router.post('/webhook', handlePaynowWebhook);
router.post('/resulturl', handlePaynowWebhook);

// EcoCash Agent webhook - called by EcoCash when cash is deposited
router.post('/ecocash-agent/webhook', handleEcocashAgentWebhook);
router.get('/ecocash-agent/webhook', testAgentWebhook); // Health check
router.post('/ecocash-agent/reconcile', reconcileEcocashAgentPayments); // Internal scheduler hook

// All other routes require authentication
router.use(protect);

// Create payment record
router.get('/', getPayments);
router.post('/create', createPayment);

// Initiate hosted checkout. Old route names stay as compatibility aliases.
router.post('/initiate', initiatePayment);
router.post('/initiate-openapi', initiatePayment);
router.post('/initiate-paynow', initiatePayment);

// Confirm cash payment (agent, pickup, delivery)
router.post('/confirm-cash', confirmCashPayment);

// EcoCash Agent payment routes
router.post('/initiate-agent', initiateAgentPayment);
router.post('/verify-agent', verifyAgentPayment);
router.post('/ecocash-agent/reconcile-admin', reconcileEcocashAgentPayments);

// Check payment status
router.get('/status/:paymentReference', checkPaymentStatus);

// Check payment expiry
router.get('/expiry/:paymentReference', checkPaymentExpiry);

// Proof of payment (printable receipt data) for a booking
router.get('/proof/:bookingId', getProofOfPayment);

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
router.post('/escrow/admin/process-scheduled-releases', adminProcessScheduledReleases);
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
