const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
  getActivityHistory,
  deactivateAccount,
  deleteAccount,
  exportMyData,
  registerDevice
} = require('../controllers/authController');
const {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/change-password', protect, changePassword);
router.get('/activity-history', protect, getActivityHistory);
router.get('/export-data', protect, exportMyData);
router.post('/deactivate', protect, deactivateAccount);
router.delete('/account', protect, deleteAccount);
// Register/update device push token (called after obtaining Expo token)
router.post('/register-device', protect, registerDevice);

module.exports = router;