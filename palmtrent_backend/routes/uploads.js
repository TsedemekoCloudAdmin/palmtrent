// routes/uploads.js
// File upload routes

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const storageService = require('../services/storageService');
const { recordAudit } = require('../services/auditService');
const { isUploadOwnedByUser } = require('../services/resourceAccessService');
const { canAccessPrivateUpload } = require('../services/privateUploadAccessService');
const { execFile } = require('child_process');

const MAGIC_BYTES = {
  'image/jpeg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'],
  'application/pdf': ['25504446']
};

// Ensure upload directories exist
const uploadDirs = [
  'uploads/cargo',
  'uploads/documents',
  'uploads/vehicles',
  'uploads/profiles',
  'uploads/signatures',
  'uploads/claims',
  'uploads/verification',
  'uploads/rental-inspections',
  'uploads/pod',
  'uploads/pod-documents',
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

const verifyMagicBytes = (file) => {
  const allowed = MAGIC_BYTES[file.mimetype];
  if (!allowed) return true;
  const buffer = fs.readFileSync(file.path, { encoding: null });
  const signature = buffer.subarray(0, 4).toString('hex');
  return allowed.some(prefix => signature.startsWith(prefix));
};

const isProduction = () => process.env.NODE_ENV === 'production';
const allowLocalStorageInProduction = () => process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === 'true';

const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const scanFile = (filePath) => new Promise((resolve, reject) => {
  const command = process.env.UPLOAD_SCAN_COMMAND;
  if (!command) {
    if (isProduction()) {
      return reject(new Error('Upload scanning is required in production'));
    }
    return resolve({ scanned: false, reason: 'UPLOAD_SCAN_COMMAND not configured' });
  }
  execFile(command, [filePath], { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || stdout || error.message));
    resolve({ scanned: true, stdout });
  });
});

const persistUpload = async (file, uploadType) => {
  await storageService.refreshConfig();
  const provider = storageService.provider || 'local';
  const key = `${uploadType}/${file.filename}`;

  if (provider === 'local') {
    if (isProduction() && !allowLocalStorageInProduction()) {
      throw new Error('Local upload storage is disabled in production');
    }
    return {
      provider: 'local',
      key,
      retainedLocalFile: true
    };
  }

  const buffer = fs.readFileSync(file.path);
  const uploaded = await storageService.uploadFile(buffer, file.filename, file.mimetype, uploadType);
  cleanupFile(file.path);
  return {
    provider: uploaded.provider,
    key: uploaded.key || key,
    storageUrl: uploaded.url,
    retainedLocalFile: false
  };
};

const buildResponseFile = ({ file, uploadType, baseUrl, storage }) => {
  const downloadPath = buildDownloadPath(uploadType, file.filename);
  const canonicalUrl = `${baseUrl}${downloadPath}`;
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: publicUploadTypes.has(uploadType) && storage.storageUrl ? storage.storageUrl : canonicalUrl,
    path: downloadPath,
    storage: {
      provider: storage.provider,
      key: storage.key
    }
  };
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
  'rental-inspections': createMulterConfig('rental-inspections', 10 * 1024 * 1024),
  pod: createMulterConfig('pod', 10 * 1024 * 1024)
};

const publicUploadTypes = new Set(['cargo', 'profiles', 'vehicles']);
const supportedUploadTypes = new Set([...Object.keys(uploadPresets), 'corporate', 'pod-documents']);

const buildDownloadPath = (uploadType, filename) => {
  if (publicUploadTypes.has(uploadType)) {
    return `/uploads/${uploadType}/${filename}`;
  }
  return `/api/v1/uploads/${uploadType}/${filename}`;
};

const getUploadTarget = (type, filename) => {
  const safeType = path.basename(type);
  const safeFilename = path.basename(filename);
  if (!supportedUploadTypes.has(safeType)) return null;

  const basePath = path.resolve(process.cwd(), 'uploads', safeType);
  const filePath = path.resolve(basePath, safeFilename);
  if (!filePath.startsWith(`${basePath}${path.sep}`)) return null;

  return { type: safeType, filename: safeFilename, basePath, filePath };
};

const requireUploadOwner = (req, res, filename) => {
  if (isUploadOwnedByUser(filename, req.user)) return true;
  res.status(403).json({
    success: false,
    message: 'Not authorized to access this upload'
  });
  return false;
};

const requireUploadAccess = async (req, res, target) => {
  if (publicUploadTypes.has(target.type)) return true;
  if (await canAccessPrivateUpload(req.user, target.type, target.filename)) return true;

  res.status(403).json({
    success: false,
    message: 'Not authorized to access this upload'
  });
  return false;
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
      if (!verifyMagicBytes(req.file)) {
        cleanupFile(req.file.path);
        return res.status(400).json({ success: false, message: 'File content does not match its declared type' });
      }
      let scanResult;
      try {
        scanResult = await scanFile(req.file.path);
      } catch (scanError) {
        cleanupFile(req.file.path);
        return res.status(400).json({ success: false, message: `File failed security scan: ${scanError.message}` });
      }

      let storage;
      try {
        storage = await persistUpload(req.file, uploadType);
      } catch (storageError) {
        cleanupFile(req.file.path);
        return res.status(500).json({ success: false, message: `File storage failed: ${storageError.message}` });
      }

      const uploadedFile = buildResponseFile({
        file: req.file,
        uploadType,
        baseUrl,
        storage
      });

      await recordAudit({
        actor: req.user,
        action: 'file.uploaded',
        entityType: 'Upload',
        entityRef: req.file.filename,
        after: {
          uploadType,
          mimetype: req.file.mimetype,
          size: req.file.size,
          scan: scanResult,
          storage: uploadedFile.storage
        },
        req
      });

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          ...uploadedFile,
          scan: scanResult
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
      const invalidFile = req.files.find(file => !verifyMagicBytes(file));
      if (invalidFile) {
        req.files.forEach(file => cleanupFile(file.path));
        return res.status(400).json({ success: false, message: `File content does not match declared type: ${invalidFile.originalname}` });
      }
      const scanResults = {};
      for (const file of req.files) {
        try {
          scanResults[file.filename] = await scanFile(file.path);
        } catch (scanError) {
          req.files.forEach(uploaded => cleanupFile(uploaded.path));
          return res.status(400).json({ success: false, message: `File failed security scan: ${file.originalname}` });
        }
      }

      const uploadedFiles = [];
      try {
        for (const file of req.files) {
          const storage = await persistUpload(file, uploadType);
          uploadedFiles.push(buildResponseFile({
            file,
            uploadType,
            baseUrl,
            storage
          }));
        }
      } catch (storageError) {
        req.files.forEach(uploaded => cleanupFile(uploaded.path));
        return res.status(500).json({ success: false, message: `File storage failed: ${storageError.message}` });
      }

      res.status(200).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        data: uploadedFiles
      });

      await recordAudit({
        actor: req.user,
        action: 'files.uploaded',
        entityType: 'Upload',
        after: {
          uploadType,
          count: uploadedFiles.length,
          scan: scanResults,
          storage: uploadedFiles.map(file => file.storage)
        },
        req
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
router.post('/rental-inspections', uploadPresets['rental-inspections'].single('file'), handleUpload('rental-inspections'));
router.post('/pod', uploadPresets.pod.single('file'), handleUpload('pod'));

// Multiple files upload routes (up to 10 files)
router.post('/cargo/multiple', uploadPresets.cargo.array('files', 10), handleMultipleUpload('cargo'));
router.post('/documents/multiple', uploadPresets.documents.array('files', 10), handleMultipleUpload('documents'));
router.post('/vehicles/multiple', uploadPresets.vehicles.array('files', 10), handleMultipleUpload('vehicles'));
router.post('/claims/multiple', uploadPresets.claims.array('files', 10), handleMultipleUpload('claims'));
router.post('/verification/multiple', uploadPresets.verification.array('files', 10), handleMultipleUpload('verification'));
router.post('/rental-inspections/multiple', uploadPresets['rental-inspections'].array('files', 10), handleMultipleUpload('rental-inspections'));
router.post('/pod/multiple', uploadPresets.pod.array('files', 5), handleMultipleUpload('pod'));

router.get('/signed-url/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const target = getUploadTarget(type, filename);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Invalid upload path' });
    }
    if (!await requireUploadAccess(req, res, target)) return;

    const key = `${target.type}/${target.filename}`;
    const signed = await storageService.getSignedDownloadUrl(key);
    if (signed.provider === 'local') {
      signed.url = buildDownloadPath(target.type, target.filename);
    }
    res.json({ success: true, data: signed });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create signed URL', error: error.message });
  }
});

// Authenticated local-file download route for private uploads.
router.get('/:type/:filename', async (req, res) => {
  try {
    const target = getUploadTarget(req.params.type, req.params.filename);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Invalid upload path' });
    }
    if (!await requireUploadAccess(req, res, target)) return;

    if (!fs.existsSync(target.filePath)) {
      const signed = await storageService.getSignedDownloadUrl(`${target.type}/${target.filename}`);
      if (signed.provider !== 'local' && signed.url) {
        return res.redirect(signed.url);
      }
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    return res.sendFile(target.filePath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to access upload',
      error: error.message
    });
  }
});

// Delete file route
router.delete('/:type/:filename', async (req, res) => {
  try {
    const target = getUploadTarget(req.params.type, req.params.filename);
    if (!target) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }
    if (!requireUploadOwner(req, res, target.filename)) return;

    // Check if file exists
    if (!fs.existsSync(target.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete file
    fs.unlinkSync(target.filePath);

    await recordAudit({
      actor: req.user,
      action: 'file.deleted',
      entityType: 'Upload',
      entityRef: target.filename,
      metadata: { type: target.type },
      req
    });

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
