const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

const validateRegistration = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('phone')
    .matches(/^\+263[0-9]{9}$/)
    .withMessage('Please provide a valid Zimbabwean phone number (+263 format)'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
    // Removed the complex password validation for now to simplify
  
  body('userType')
    .isIn(['shipper', 'transporter', 'trailer_owner', 'corporate'])
    .withMessage('User type must be shipper, transporter, trailer_owner, or corporate'),
  
  handleValidationErrors
];

const validateLogin = [
  body().custom((_, { req }) => {
    const phone = req.body.phone;
    const email = req.body.email;

    if (!phone && !email) {
      throw new Error('Please provide an email address or Zimbabwean phone number');
    }

    if (phone && !/^\+263[0-9]{9}$/.test(phone)) {
      throw new Error('Please provide a valid Zimbabwean phone number');
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error('Please provide a valid email');
    }

    return true;
  }),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  handleValidationErrors
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  
  handleValidationErrors
];

const validatePhoneVerification = [
  body('phone')
    .matches(/^\+263[0-9]{9}$/)
    .withMessage('Please provide a valid Zimbabwean phone number'),
  
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validatePhoneVerification,
  handleValidationErrors
};
