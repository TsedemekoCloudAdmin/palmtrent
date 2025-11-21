const VerificationCode = require('../models/VerificationCode');
const { generateVerificationCode } = require('../utils/generateCode');
const { sendVerificationSMS } = require('../utils/sendSMS');

// Send verification code
const sendVerificationCode = async (req, res) => {
  try {
    const { phone } = req.body;
console.log(phone);
    // Generate 6-digit code
    const code = generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing codes for this phone
    await VerificationCode.deleteMany({
      phone,
      type: 'phone_verification'
    });

    // Save new code
    await VerificationCode.create({
      phone,
      code,
      type: 'phone_verification',
      expiresAt
    });

    // Send SMS
    const smsSent = await sendVerificationSMS(phone, code);

    if (!smsSent) {
      return res.status(500).json({
        success: false,
        message: 'Error sending verification code'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification code',
      error: error.message
    });
  }
};

// Verify code
const verifyCode = async (req, res) => {
  try {
    const { phone, code } = req.body;

    // Find valid code
    const verificationCode = await VerificationCode.findOne({
      phone,
      code,
      type: 'phone_verification',
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verificationCode) {
      // Increment attempts if code exists but is invalid
      const existingCode = await VerificationCode.findOne({
        phone,
        type: 'phone_verification'
      });

      if (existingCode) {
        existingCode.attempts += 1;
        await existingCode.save();

        if (existingCode.attempts >= existingCode.maxAttempts) {
          await VerificationCode.deleteMany({
            phone,
            type: 'phone_verification'
          });

          return res.status(400).json({
            success: false,
            message: 'Too many failed attempts. Please request a new code.'
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Mark code as used
    verificationCode.used = true;
    await verificationCode.save();

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying code',
      error: error.message
    });
  }
};

// Resend verification code
const resendVerificationCode = async (req, res) => {
  try {
    const { phone } = req.body;

    // Check rate limiting (prevent spam)
    const recentCode = await VerificationCode.findOne({
      phone,
      type: 'phone_verification',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // 1 minute ago
    });

    if (recentCode) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting a new code'
      });
    }

    // Generate new code
    const code = generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete old codes
    await VerificationCode.deleteMany({
      phone,
      type: 'phone_verification'
    });

    // Save new code
    await VerificationCode.create({
      phone,
      code,
      type: 'phone_verification',
      expiresAt
    });

    // Send SMS
    const smsSent = await sendVerificationSMS(phone, code);

    if (!smsSent) {
      return res.status(500).json({
        success: false,
        message: 'Error sending verification code'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending verification code',
      error: error.message
    });
  }
};

module.exports = {
  sendVerificationCode,
  verifyCode,
  resendVerificationCode
};