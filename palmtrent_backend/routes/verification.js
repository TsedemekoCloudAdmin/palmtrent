const express = require('express');
const {
  sendVerificationCode,
  verifyCode,
  resendVerificationCode
} = require('../controllers/verificationController');
const {
  validatePhoneVerification
} = require('../middleware/validation');

const router = express.Router();

router.post('/send-code', validatePhoneVerification, sendVerificationCode);
router.post('/verify', validatePhoneVerification, verifyCode);
router.post('/resend-code', validatePhoneVerification, resendVerificationCode);

module.exports = router;