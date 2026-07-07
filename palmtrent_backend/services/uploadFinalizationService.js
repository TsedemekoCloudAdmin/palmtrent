const fs = require('fs');
const storageService = require('./storageService');
const { scanFile } = require('./uploadScanService');

const MAGIC_BYTES = {
  'image/jpeg': ['ffd8ff'],
  'image/jpg': ['ffd8ff'],
  'image/png': ['89504e47'],
  'image/webp': ['52494646'],
  'application/pdf': ['25504446']
};

const PUBLIC_UPLOAD_TYPES = new Set(['cargo', 'profiles', 'vehicles']);

const isProduction = () => process.env.NODE_ENV === 'production';
const allowLocalStorageInProduction = () => process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === 'true';

const cleanupLocalFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const verifyMagicBytes = (file) => {
  const allowed = MAGIC_BYTES[file.mimetype];
  if (!allowed) return true;
  const buffer = fs.readFileSync(file.path);
  const signature = buffer.subarray(0, 4).toString('hex');
  return allowed.some(prefix => signature.startsWith(prefix));
};

const buildDownloadPath = (uploadType, filename) => {
  if (PUBLIC_UPLOAD_TYPES.has(uploadType)) {
    return `/uploads/${uploadType}/${filename}`;
  }
  return `/api/v1/uploads/${uploadType}/${filename}`;
};

const finalizeUploadedFile = async (file, uploadType) => {
  if (!file?.path || !file?.filename) {
    throw new Error('No uploaded file to finalize');
  }

  try {
    if (!verifyMagicBytes(file)) {
      throw new Error('File content does not match its declared type');
    }

    const scan = await scanFile(file.path);
    await storageService.refreshConfig();
    const provider = storageService.provider || 'local';
    const key = `${uploadType}/${file.filename}`;
    let storageUrl;

    if (provider === 'local') {
      if (isProduction() && !allowLocalStorageInProduction()) {
        throw new Error('Local upload storage is disabled in production');
      }
    } else {
      const buffer = fs.readFileSync(file.path);
      const uploaded = await storageService.uploadFile(buffer, file.filename, file.mimetype, uploadType);
      storageUrl = uploaded.url;
      cleanupLocalFile(file.path);
      return {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: PUBLIC_UPLOAD_TYPES.has(uploadType) && storageUrl ? storageUrl : buildDownloadPath(uploadType, file.filename),
        path: buildDownloadPath(uploadType, file.filename),
        key: uploaded.key || key,
        provider: uploaded.provider || provider,
        storageUrl,
        scan
      };
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: buildDownloadPath(uploadType, file.filename),
      path: buildDownloadPath(uploadType, file.filename),
      key,
      provider: 'local',
      scan
    };
  } catch (error) {
    cleanupLocalFile(file.path);
    throw error;
  }
};

const finalizeUploadedFiles = async (files, uploadType) => {
  const finalized = [];
  try {
    for (const file of files || []) {
      finalized.push(await finalizeUploadedFile(file, uploadType));
    }
    return finalized;
  } catch (error) {
    (files || []).forEach(file => cleanupLocalFile(file.path));
    throw error;
  }
};

module.exports = {
  buildDownloadPath,
  cleanupLocalFile,
  finalizeUploadedFile,
  finalizeUploadedFiles,
  scanFile,
  verifyMagicBytes
};
