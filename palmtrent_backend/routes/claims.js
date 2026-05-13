// routes/claims.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createDispute,
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

const claimsDir = path.join(__dirname, '..', 'uploads', 'claims');
fs.mkdirSync(claimsDir, { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, claimsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${req.user.id}-evidence-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }
});

// All routes require authentication
router.use(protect);

// Compatibility endpoint for the mobile dispute form
router.post('/', evidenceUpload.array('evidence', 10), createDispute);

// User routes
router.get('/me', getMyClaims);
router.post('/booking/:bookingId', createClaim);

// Admin routes must be registered before /:claimId
router.get('/admin/all', adminGetClaims);
router.put('/admin/:claimId/status', adminUpdateStatus);

router.get('/:claimId', getClaim);
router.post('/:claimId/documents', uploadDocument);
router.post('/:claimId/submit', submitClaim);
router.post('/:claimId/message', addCommunication);
router.post('/:claimId/withdraw', withdrawClaim);

module.exports = router;
