const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignDriver,
  getAvailableForRental,
  updateRentalSettings,
  types,
  recommend,
  uploadVehiclePhoto,
  getVehiclePhotos,
  deleteVehiclePhoto
} = require('../controllers/vehicleController');

// Configure multer for vehicle photo uploads
const vehicleUploadDir = path.join(__dirname, '../uploads/vehicles');
if (!fs.existsSync(vehicleUploadDir)) {
  fs.mkdirSync(vehicleUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vehicleUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `vehicle-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.route('/')
  .get(protect, getVehicles)
  .post(protect, createVehicle);

router.route('/my-vehicles')
  .get(protect, getVehicles);

router.route('/available-for-rental')
  .get(getAvailableForRental);

router.route('/availability')
  .get(getAvailableForRental);

router.route('/types')
  .get(protect, types);

router.route('/recommend')
  .post(protect, recommend);

router.route('/:id')
  .get(protect, getVehicle)
  .put(protect, updateVehicle)
  .delete(protect, deleteVehicle);

router.route('/:id/status')
  .put(protect, updateVehicle);

router.route('/:id/assign-driver')
  .post(protect, assignDriver)
  .put(protect, assignDriver);

router.route('/:id/rental-settings')
  .put(protect, updateRentalSettings);

// Photo routes
router.route('/:id/photos')
  .get(protect, getVehiclePhotos)
  .post(protect, upload.single('photo'), uploadVehiclePhoto);

router.route('/:id/photos/:photoType')
  .delete(protect, deleteVehiclePhoto);

module.exports = router;
