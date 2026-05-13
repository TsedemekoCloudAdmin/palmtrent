const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"Palmtrent" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - Palmtrent',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0C2D48;">Password Reset Request</h2>
          <p>You requested to reset your password for your Palmtrent account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #0C2D48; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            © ${new Date().getFullYear()} Palmtrent. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Palmtrent" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification - Palmtrent',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0C2D48;">Verify Your Email</h2>
          <p>Thank you for registering with Palmtrent!</p>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #0C2D48; text-align: center; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p>Enter this code in the app to complete your registration.</p>
          <p>This code will expire in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            © ${new Date().getFullYear()} Palmtrent. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail
};
