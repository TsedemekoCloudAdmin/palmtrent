const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  registerCorporateAccount,
  uploadDocument,
  getProfile,
  updateProfile,
  getInvoices,
  getInvoiceById,
  getAnalytics,
  getDashboardStats,
  getUsers,
  inviteUser,
  updateUser,
  removeUser,
  getBillingInfo,
  updateBillingInfo,
  getPaymentMethods,
  addPaymentMethod,
  generateInvoice,
  updateInvoiceStatus
} = require('../controllers/corporateController');
const { protect, requireCorporateRole } = require('../middleware/auth');

// Configure multer for document uploads
const corporateUploadDir = path.join(__dirname, '..', 'uploads', 'corporate');
fs.mkdirSync(corporateUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, corporateUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All routes require authentication
router.use(protect);

// POST /api/v1/corporate/register - Register corporate account
router.post('/register', registerCorporateAccount);

// POST /api/v1/corporate/documents - Upload corporate documents
router.post('/documents', upload.single('document'), uploadDocument);

// GET /api/v1/corporate/profile - Get corporate profile
router.get('/profile', getProfile);

// PUT /api/v1/corporate/profile - Update corporate profile
router.put('/profile', requireCorporateRole('admin', 'manager'), updateProfile);

// GET /api/v1/corporate/invoices - Get invoices
router.get('/invoices', getInvoices);
router.post('/invoices/generate', requireCorporateRole('admin', 'manager'), generateInvoice);
router.get('/invoices/:id', getInvoiceById);
router.get('/invoices/:id/download', getInvoiceById);
router.put('/invoices/:id/status', requireCorporateRole('admin', 'manager'), updateInvoiceStatus);

// GET /api/v1/corporate/analytics - Get analytics
router.get('/analytics', getAnalytics);

// GET /api/v1/corporate/dashboard-stats - Get dashboard stats
router.get('/dashboard-stats', getDashboardStats);

router.get('/users', getUsers);
router.post('/users/invite', requireCorporateRole('admin'), inviteUser);
router.put('/users/:userId', requireCorporateRole('admin'), updateUser);
router.delete('/users/:userId', requireCorporateRole('admin'), removeUser);

router.get('/billing', getBillingInfo);
router.put('/billing', requireCorporateRole('admin'), updateBillingInfo);

router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', requireCorporateRole('admin'), addPaymentMethod);

module.exports = router;
