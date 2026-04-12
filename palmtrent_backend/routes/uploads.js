// routes/uploads.js
// File upload routes

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const storageService = require('../services/storageService');

// Ensure upload directories exist
const uploadDirs = [
  'uploads/cargo',
  'uploads/documents',
  'uploads/vehicles',
  'uploads/profiles',
  'uploads/signatures',
  'uploads/claims',
  'uploads/verification',
  'uploads/pod',
  'uploads/temp'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Configure multer for different upload types
const createMulterConfig = (folder, maxSize = 10 * 1024 * 1024) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), 'uploads', folder);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = storageService.generateFilename(file.originalname, `${req.user._id}-`);
      cb(null, uniqueName);
    }
  });

  const fileFilter = (req, file, cb) => {
    const config = storageService.getUploadConfig(folder);
    if (config.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed for ${folder}`), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSize }
  });
};

// Upload presets
const uploadPresets = {
  cargo: createMulterConfig('cargo', 10 * 1024 * 1024),
  documents: createMulterConfig('documents', 20 * 1024 * 1024),
  vehicles: createMulterConfig('vehicles', 10 * 1024 * 1024),
  profiles: createMulterConfig('profiles', 5 * 1024 * 1024),
  signatures: createMulterConfig('signatures', 2 * 1024 * 1024),
  claims: createMulterConfig('claims', 15 * 1024 * 1024),
  verification: createMulterConfig('verification', 10 * 1024 * 1024),
  pod: createMulterConfig('pod', 10 * 1024 * 1024)
};

// Generic upload handler
const handleUpload = (uploadType) => {
  return async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      const fileUrl = `${baseUrl}/uploads/${uploadType}/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url: fileUrl,
          path: `/uploads/${uploadType}/${req.file.filename}`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file',
        error: error.message
      });
    }
  };
};

// Handle multiple files upload
const handleMultipleUpload = (uploadType) => {
  return async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

      const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: `${baseUrl}/uploads/${uploadType}/${file.filename}`,
        path: `/uploads/${uploadType}/${file.filename}`
      }));

      res.status(200).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        data: uploadedFiles
      });
    } catch (error) {
      console.error('Multiple upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload files',
        error: error.message
      });
    }
  };
};

// All routes require authentication
router.use(protect);

// Single file upload routes
router.post('/cargo', uploadPresets.cargo.single('file'), handleUpload('cargo'));
router.post('/documents', uploadPresets.documents.single('file'), handleUpload('documents'));
router.post('/vehicles', uploadPresets.vehicles.single('file'), handleUpload('vehicles'));
router.post('/profiles', uploadPresets.profiles.single('file'), handleUpload('profiles'));
router.post('/signatures', uploadPresets.signatures.single('file'), handleUpload('signatures'));
router.post('/claims', uploadPresets.claims.single('file'), handleUpload('claims'));
router.post('/verification', uploadPresets.verification.single('file'), handleUpload('verification'));
router.post('/pod', uploadPresets.pod.single('file'), handleUpload('pod'));

// Multiple files upload routes (up to 10 files)
router.post('/cargo/multiple', uploadPresets.cargo.array('files', 10), handleMultipleUpload('cargo'));
router.post('/documents/multiple', uploadPresets.documents.array('files', 10), handleMultipleUpload('documents'));
router.post('/vehicles/multiple', uploadPresets.vehicles.array('files', 10), handleMultipleUpload('vehicles'));
router.post('/claims/multiple', uploadPresets.claims.array('files', 10), handleMultipleUpload('claims'));
router.post('/verification/multiple', uploadPresets.verification.array('files', 10), handleMultipleUpload('verification'));
router.post('/pod/multiple', uploadPresets.pod.array('files', 5), handleMultipleUpload('pod'));

// Delete file route
router.delete('/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', type, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the allowed limit'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded'
      });
    }
  }

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Upload error'
    });
  }

  next();
});

module.exports = router;
