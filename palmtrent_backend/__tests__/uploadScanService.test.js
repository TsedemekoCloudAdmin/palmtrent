jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

const { execFile } = require('child_process');
const { scanFile, parseScanCommand, UploadScanError } = require('../services/uploadScanService');

describe('uploadScanService', () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
    jest.clearAllMocks();
  });

  describe('parseScanCommand', () => {
    test('splits command and arguments', () => {
      expect(parseScanCommand('clamscan --no-summary')).toEqual(['clamscan', '--no-summary']);
    });

    test('keeps quoted segments intact', () => {
      expect(parseScanCommand('"C:\\Program Files\\scanner\\scan.exe" --fast'))
        .toEqual(['C:\\Program Files\\scanner\\scan.exe', '--fast']);
    });
  });

  test('skips scanning outside production when not configured', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.UPLOAD_SCAN_COMMAND;

    await expect(scanFile('/tmp/file')).resolves.toMatchObject({ scanned: false });
    expect(execFile).not.toHaveBeenCalled();
  });

  test('rejects unscanned production uploads when not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.UPLOAD_SCAN_COMMAND;

    await expect(scanFile('/tmp/file')).rejects.toThrow('Upload scanning is required in production');
  });

  test('honors an explicit disabled value without spawning anything', async () => {
    process.env.UPLOAD_SCAN_COMMAND = 'disabled';

    await expect(scanFile('/tmp/file')).resolves.toMatchObject({
      scanned: false,
      reason: 'Upload scanning disabled by configuration'
    });
    expect(execFile).not.toHaveBeenCalled();
  });

  test('passes arguments separately and appends the file path', async () => {
    process.env.UPLOAD_SCAN_COMMAND = 'clamscan --no-summary';
    execFile.mockImplementation((cmd, args, opts, cb) => cb(null, 'OK', ''));

    await expect(scanFile('/tmp/file.jpg')).resolves.toMatchObject({ scanned: true });
    expect(execFile).toHaveBeenCalledWith(
      'clamscan',
      ['--no-summary', '/tmp/file.jpg'],
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('classifies a missing scanner binary as unavailable, not a scan failure', async () => {
    process.env.UPLOAD_SCAN_COMMAND = 'not-a-real-scanner';
    const enoent = Object.assign(new Error('spawn not-a-real-scanner ENOENT'), { code: 'ENOENT' });
    execFile.mockImplementation((cmd, args, opts, cb) => cb(enoent, '', ''));

    await expect(scanFile('/tmp/file')).rejects.toMatchObject({
      name: 'UploadScanError',
      kind: 'unavailable'
    });
  });

  test('classifies a non-zero scanner exit as a rejected file', async () => {
    process.env.UPLOAD_SCAN_COMMAND = 'clamscan';
    const detection = Object.assign(new Error('exit 1'), { code: 1 });
    execFile.mockImplementation((cmd, args, opts, cb) => cb(detection, '', 'Eicar-Test-Signature FOUND'));

    await expect(scanFile('/tmp/file')).rejects.toMatchObject({
      name: 'UploadScanError',
      kind: 'rejected',
      message: 'Eicar-Test-Signature FOUND'
    });
  });
});
