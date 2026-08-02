const VerificationCode = require('../models/VerificationCode');
const { generateVerificationCode } = require('../utils/generateCode');
const { sendVerificationSMS } = require('../utils/sendSMS');
const { sendVerificationEmail } = require('../utils/sendEmail');
const { isSmsDeliveryDisabled } = require('../utils/smsSettings');

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * Build a query filter from the request body.
 * Accepts either { phone } (SMS path) or { email } (email path).
 */
function buildTarget(body) {
  if (body.email) {
    return { key: 'email', value: String(body.email).trim().toLowerCase() };
  }
  if (body.phone) {
    return { key: 'phone', value: String(body.phone).trim() };
  }
  return null;
}

// ─── Send verification code ─────────────────────────────────────────────────

const sendVerificationCode = async (req, res) => {
  try {
    const target = buildTarget(req.body);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Provide either phone or email to receive a verification code.' });
    }

    const { key, value } = target;
    const verificationType = key === 'email' ? 'email_verification' : 'phone_verification';

    const code = generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unused codes for this contact
    await VerificationCode.deleteMany({ [key]: value, type: verificationType });

    await VerificationCode.create({ [key]: value, code, type: verificationType, expiresAt });

    let sent = false;
    if (key === 'email') {
      sent = await sendVerificationEmail(value, code);
    } else {
      if (isSmsDeliveryDisabled()) {
        sent = true;
      } else {
        sent = await sendVerificationSMS(value, code);
      }
    }

    if (!sent) {
      return res.status(500).json({ success: false, message: `Error sending verification code via ${key === 'email' ? 'email' : 'SMS'}` });
    }

    res.json({
      success: true,
      channel: key,
      message: isSmsDeliveryDisabled() && key !== 'email'
        ? 'Verification code generated for testing'
        : `Verification code sent to your ${key === 'email' ? 'email address' : 'phone'}`,
      ...(isSmsDeliveryDisabled() && key !== 'email' ? { data: { code } } : {})
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({ success: false, message: 'Error sending verification code', error: error.message });
  }
};

// ─── Verify code ─────────────────────────────────────────────────────────────

const verifyCode = async (req, res) => {
  try {
    const target = buildTarget(req.body);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Provide either phone or email to verify.' });
    }

    const { key, value } = target;
    const { code } = req.body;
    const verificationType = key === 'email' ? 'email_verification' : 'phone_verification';

    const verificationCode = await VerificationCode.findOne({
      [key]: value,
      code,
      type: verificationType,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!verificationCode) {
      const existingCode = await VerificationCode.findOne({ [key]: value, type: verificationType });
      if (existingCode) {
        existingCode.attempts += 1;
        await existingCode.save();
        if (existingCode.attempts >= existingCode.maxAttempts) {
          await VerificationCode.deleteMany({ [key]: value, type: verificationType });
          return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new code.' });
        }
      }
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    verificationCode.used = true;
    await verificationCode.save();

    res.json({
      success: true,
      channel: key,
      message: key === 'email' ? 'Email address verified successfully' : 'Phone number verified successfully'
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ success: false, message: 'Error verifying code', error: error.message });
  }
};

// ─── Resend verification code ────────────────────────────────────────────────

const resendVerificationCode = async (req, res) => {
  try {
    const target = buildTarget(req.body);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Provide either phone or email.' });
    }

    const { key, value } = target;
    const verificationType = key === 'email' ? 'email_verification' : 'phone_verification';

    // Rate limiting: 60 seconds between resends
    const recentCode = await VerificationCode.findOne({
      [key]: value,
      type: verificationType,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
    });
    if (recentCode) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting a new code.' });
    }

    const code = generateVerificationCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationCode.deleteMany({ [key]: value, type: verificationType });
    await VerificationCode.create({ [key]: value, code, type: verificationType, expiresAt });

    let sent = false;
    if (key === 'email') {
      sent = await sendVerificationEmail(value, code);
    } else {
      sent = isSmsDeliveryDisabled() ? true : await sendVerificationSMS(value, code);
    }

    if (!sent) {
      return res.status(500).json({ success: false, message: `Error resending verification code via ${key === 'email' ? 'email' : 'SMS'}` });
    }

    res.json({
      success: true,
      channel: key,
      message: `Verification code resent to your ${key === 'email' ? 'email address' : 'phone'}`,
      ...(isSmsDeliveryDisabled() && key !== 'email' ? { data: { code } } : {})
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({ success: false, message: 'Error resending verification code', error: error.message });
  }
};

module.exports = {
  sendVerificationCode,
  verifyCode,
  resendVerificationCode
};
