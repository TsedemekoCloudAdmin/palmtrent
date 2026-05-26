const requiredAlways = ['JWT_SECRET', 'MONGODB_URI'];

const requiredInProduction = [
  'INTEGRATION_SECRET_KEY',
  'FRONTEND_URL',
  'API_BASE_URL',
  'CORS_ORIGINS',
  'INTERNAL_JOB_KEY',
  'MAPBOX_ACCESS_TOKEN',
  'OPENAPI_AFRICA_PUBLIC_UNIQUE_ID',
  'OPENAPI_AFRICA_RETURN_URL',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'FIREBASE_SERVICE_ACCOUNT',
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'STORAGE_DRIVER',
  'UPLOAD_SCAN_COMMAND'
];

const paynowDirectRailRequired = [
  'PAYNOW_INTEGRATION_ID',
  'PAYNOW_INTEGRATION_KEY',
  'PAYNOW_RESULT_URL',
  'PAYNOW_RETURN_URL'
];

const storageRequiredByDriver = {
  s3: ['STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY'],
  r2: ['STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'STORAGE_ENDPOINT']
};

function hasValue(key) {
  return Boolean(process.env[key] && String(process.env[key]).trim());
}

function isPlaceholderValue(key) {
  const value = String(process.env[key] || '').trim().toLowerCase();
  if (!value) return false;

  if (value.includes('replace-with') || value.startsWith('your_') || value.startsWith('your-')) {
    return true;
  }

  if (['frontend_url', 'api_base_url'].includes(key.toLowerCase())) {
    return value.includes('.example') || value.includes('localhost');
  }

  if (key === 'JWT_SECRET' || key === 'INTEGRATION_SECRET_KEY') {
    return value.length < 32 || value.includes('secret');
  }

  return false;
}

function getMissingEnv({ production = process.env.NODE_ENV === 'production' } = {}) {
  const required = [...requiredAlways];

  if (production) {
    required.push(...requiredInProduction);
    if (process.env.ENABLE_PAYNOW_DIRECT_RAIL === 'true') {
      required.push(...paynowDirectRailRequired);
    }

    const storageDriver = (process.env.STORAGE_DRIVER || process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    required.push(...(storageRequiredByDriver[storageDriver] || []));
  }

  return [...new Set(required)].filter(key => !hasValue(key));
}

function getPlaceholderEnv({ production = process.env.NODE_ENV === 'production' } = {}) {
  const keys = production
    ? [
        ...requiredAlways,
        ...requiredInProduction,
        ...(process.env.ENABLE_PAYNOW_DIRECT_RAIL === 'true' ? paynowDirectRailRequired : []),
        ...(storageRequiredByDriver[(process.env.STORAGE_DRIVER || process.env.STORAGE_PROVIDER || 'local').toLowerCase()] || [])
      ]
    : requiredAlways;

  return [...new Set(keys)].filter(isPlaceholderValue);
}

function getConfigurationWarnings({ production = process.env.NODE_ENV === 'production' } = {}) {
  const warnings = [];

  if (production) {
    const storageDriver = (process.env.STORAGE_DRIVER || process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    if (storageDriver === 'local' && process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== 'true') {
      warnings.push('STORAGE_DRIVER is local. Use object storage for production uploads or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true after accepting the operational risk.');
    }

    if ((process.env.OPENAPI_AFRICA_BASE_URL || '').includes('localhost')) {
      warnings.push('OPENAPI_AFRICA_BASE_URL points to localhost.');
    }
  }

  return warnings;
}

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = getMissingEnv({ production: isProduction });
  const placeholders = getPlaceholderEnv({ production: isProduction });
  const warnings = getConfigurationWarnings({ production: isProduction });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (placeholders.length > 0) {
    throw new Error(`Environment variables still contain placeholder or unsafe values: ${placeholders.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn(`Production configuration warning: ${warnings.join(' ')}`);
  }
}

module.exports = validateEnv;
module.exports.requiredAlways = requiredAlways;
module.exports.requiredInProduction = requiredInProduction;
module.exports.paynowDirectRailRequired = paynowDirectRailRequired;
module.exports.getMissingEnv = getMissingEnv;
module.exports.getPlaceholderEnv = getPlaceholderEnv;
module.exports.getConfigurationWarnings = getConfigurationWarnings;
