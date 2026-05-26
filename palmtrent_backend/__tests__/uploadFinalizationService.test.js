const fs = require('fs');
const path = require('path');

jest.mock('../services/storageService', () => ({
  refreshConfig: jest.fn().mockResolvedValue(),
  provider: 'local'
}));

const {
  finalizeUploadedFile
} = require('../services/uploadFinalizationService');

const makeTempFile = (contents, mimetype = 'image/jpeg') => {
  const parentDir = path.join(process.cwd(), 'uploads', 'temp');
  fs.mkdirSync(parentDir, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parentDir, 'upload-finalize-'));
  const filePath = path.join(dir, 'upload.jpg');
  fs.writeFileSync(filePath, contents);
  return {
    dir,
    file: {
      path: filePath,
      filename: 'user-upload.jpg',
      originalname: 'upload.jpg',
      mimetype,
      size: fs.statSync(filePath).size
    }
  };
};

describe('uploadFinalizationService', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  test('rejects unscanned production uploads and removes the temporary file', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.UPLOAD_SCAN_COMMAND;

    const jpegHeader = Buffer.from('ffd8ffe000', 'hex');
    const { dir, file } = makeTempFile(Buffer.concat([jpegHeader, Buffer.from('payload')]));

    await expect(finalizeUploadedFile(file, 'claims')).rejects.toThrow('Upload scanning is required in production');
    expect(fs.existsSync(file.path)).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('rejects files whose bytes do not match the declared type', async () => {
    process.env.NODE_ENV = 'test';

    const { dir, file } = makeTempFile(Buffer.from('not-a-jpeg'));

    await expect(finalizeUploadedFile(file, 'claims')).rejects.toThrow('File content does not match its declared type');
    expect(fs.existsSync(file.path)).toBe(false);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
