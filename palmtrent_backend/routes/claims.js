// routes/claims.js
const express = require('express');
const router = express.Router();
const {
  createClaim,
  uploadDocument,
  submitClaim,
  getClaim,
  getMyClaims,
  addCommunication,
  withdrawClaim,
  adminUpdateStatus,
  adminGetClaims
} = require('../controllers/claimsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes
router.get('/me', getMyClaims);
router.post('/booking/:bookingId', createClaim);
router.get('/:claimId', getClaim);
router.post('/:claimId/documents', uploadDocument);
router.post('/:claimId/submit', submitClaim);
router.post('/:claimId/message', addCommunication);
router.post('/:claimId/withdraw', withdrawClaim);

// Admin routes
router.get('/admin/all', adminGetClaims);
router.put('/admin/:claimId/status', adminUpdateStatus);

module.exports = router;
