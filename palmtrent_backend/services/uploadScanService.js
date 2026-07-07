const { execFile } = require('child_process');

// Values an operator can set to explicitly turn scanning off (e.g. UPLOAD_SCAN_COMMAND=disabled).
const SCAN_DISABLED_VALUES = new Set(['disabled', 'off', 'none', 'skip']);

const SCAN_TIMEOUT_MS = 30000;

class UploadScanError extends Error {
  /**
   * @param {string} message
   * @param {'unavailable'|'rejected'} kind - 'unavailable' means the scanner never ran
   *   (misconfiguration, missing binary, timeout); 'rejected' means the scanner ran and
   *   flagged the file.
   */
  constructor(message, kind) {
    super(message);
    this.name = 'UploadScanError';
    this.kind = kind;
  }
}

const isProduction = () => process.env.NODE_ENV === 'production';

// Split a configured command line like `clamscan --no-summary` into command + args.
// execFile does not parse command strings, so passing the raw value as the executable
// name fails with ENOENT (e.g. "spawn echo scan-disabled ENOENT").
const parseScanCommand = (raw) => {
  const parts = raw.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return parts.map(part => part.replace(/^(["'])(.*)\1$/, '$2'));
};

const scanFile = (filePath) => new Promise((resolve, reject) => {
  const rawCommand = (process.env.UPLOAD_SCAN_COMMAND || '').trim();
  if (!rawCommand) {
    if (isProduction()) {
      return reject(new UploadScanError('Upload scanning is required in production', 'unavailable'));
    }
    return resolve({ scanned: false, reason: 'UPLOAD_SCAN_COMMAND not configured' });
  }
  if (SCAN_DISABLED_VALUES.has(rawCommand.toLowerCase())) {
    return resolve({ scanned: false, reason: 'Upload scanning disabled by configuration' });
  }

  const [command, ...args] = parseScanCommand(rawCommand);
  execFile(command, [...args, filePath], { timeout: SCAN_TIMEOUT_MS }, (error, stdout, stderr) => {
    if (!error) return resolve({ scanned: true, stdout });

    // String error codes (ENOENT, EACCES, ...) and timeouts mean the scanner never ran.
    // Surface that as an infrastructure problem instead of blaming the file.
    if (typeof error.code === 'string' || error.killed) {
      console.error(`Upload scanner could not run (command: ${command}):`, error.message);
      return reject(new UploadScanError(`Upload scanner could not run: ${error.message}`, 'unavailable'));
    }

    // Non-zero numeric exit code: the scanner ran and rejected the file (clamscan uses 1).
    return reject(new UploadScanError(stderr || stdout || error.message, 'rejected'));
  });
});

module.exports = {
  UploadScanError,
  parseScanCommand,
  scanFile
};
