const crypto = require('crypto');
const mongoose = require('mongoose');
const IntegrationSetting = require('../models/IntegrationSetting');

const definitions = {
  paynow: {
    provider: 'paynow',
    label: 'Optional Paynow Direct EcoCash/OneMoney Rail',
    category: 'payments',
    requiredFields: ['integrationId', 'integrationKey'],
    secretFields: ['integrationKey'],
    envMap: {
      integrationId: 'PAYNOW_INTEGRATION_ID',
      integrationKey: 'PAYNOW_INTEGRATION_KEY',
      resultUrl: 'PAYNOW_RESULT_URL',
      returnUrl: 'PAYNOW_RETURN_URL'
    }
  },
  openapiAfrica: {
    provider: 'openapiAfrica',
    label: 'OpenAPI Africa ClicknPay',
    category: 'payments',
    requiredFields: ['publicUniqueId'],
    secretFields: [],
    envMap: {
      publicUniqueId: 'OPENAPI_AFRICA_PUBLIC_UNIQUE_ID',
      baseUrl: 'OPENAPI_AFRICA_BASE_URL',
      returnUrl: 'OPENAPI_AFRICA_RETURN_URL',
      currency: 'OPENAPI_AFRICA_CURRENCY'
    }
  },
  mapbox: {
    provider: 'mapbox',
    label: 'Mapbox',
    category: 'maps',
    requiredFields: ['accessToken'],
    secretFields: ['accessToken'],
    envMap: {
      accessToken: 'MAPBOX_ACCESS_TOKEN'
    }
  },
  whatsapp: {
    provider: 'whatsapp',
    label: 'WhatsApp Business',
    category: 'messaging',
    requiredFields: ['phoneNumberId', 'accessToken', 'verifyToken', 'appSecret'],
    secretFields: ['accessToken', 'verifyToken', 'appSecret'],
    envMap: {
      phoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID',
      accessToken: 'WHATSAPP_ACCESS_TOKEN',
      verifyToken: 'WHATSAPP_VERIFY_TOKEN',
      appSecret: 'WHATSAPP_APP_SECRET',
      businessAccountId: 'WHATSAPP_BUSINESS_ACCOUNT_ID'
    }
  },
  firebase: {
    provider: 'firebase',
    label: 'Firebase Push',
    category: 'notifications',
    requiredFields: ['serviceAccountJson'],
    secretFields: ['serviceAccountJson'],
    envMap: {
      serviceAccountJson: 'FIREBASE_SERVICE_ACCOUNT'
    }
  },
  storage: {
    provider: 'storage',
    label: 'Object Storage',
    category: 'storage',
    requiredFields: ['driver'],
    secretFields: ['accessKeyId', 'secretAccessKey'],
    envMap: {
      driver: 'STORAGE_DRIVER',
      bucket: 'STORAGE_BUCKET',
      region: 'STORAGE_REGION',
      accessKeyId: 'STORAGE_ACCESS_KEY_ID',
      secretAccessKey: 'STORAGE_SECRET_ACCESS_KEY',
      endpoint: 'STORAGE_ENDPOINT',
      baseUrl: 'STORAGE_BASE_URL'
    }
  },
  email: {
    provider: 'email',
    label: 'Transactional Email',
    category: 'email',
    requiredFields: ['host', 'user', 'pass'],
    secretFields: ['pass'],
    envMap: {
      host: 'EMAIL_HOST',
      port: 'EMAIL_PORT',
      user: 'EMAIL_USER',
      pass: 'EMAIL_PASS',
      from: 'EMAIL_FROM'
    }
  },
  uploadScanner: {
    provider: 'uploadScanner',
    label: 'Upload Malware Scanner',
    category: 'security',
    requiredFields: ['scanCommand'],
    secretFields: [],
    envMap: {
      scanCommand: 'UPLOAD_SCAN_COMMAND'
    }
  }
};

function getCipherKey() {
  const source = process.env.INTEGRATION_SECRET_KEY || process.env.JWT_SECRET || 'palmtrent-dev-integration-secret';
  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(value) {
  if (!value || typeof value !== 'string') return undefined;
  if (!value.startsWith('v1:')) return value;
  const [, iv, tag, encrypted] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function mapToObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return value;
}

function envSettings(definition) {
  return Object.entries(definition.envMap || {}).reduce((settings, [field, envKey]) => {
    if (process.env[envKey]) settings[field] = process.env[envKey];
    return settings;
  }, {});
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function getEffectiveSettings(docOrProvider, { includeSecrets = false } = {}) {
  const provider = typeof docOrProvider === 'string' ? docOrProvider : docOrProvider.provider;
  const definition = definitions[provider];
  if (!definition) return {};

  const docSettings = typeof docOrProvider === 'string' ? {} : mapToObject(docOrProvider.settings);
  const encryptedSecrets = typeof docOrProvider === 'string' ? {} : mapToObject(docOrProvider.encryptedSecrets);
  const base = envSettings(definition);
  const merged = { ...base, ...docSettings };

  if (includeSecrets) {
    Object.keys(encryptedSecrets).forEach((field) => {
      const decrypted = decryptSecret(encryptedSecrets[field]);
      if (hasValue(decrypted)) merged[field] = decrypted;
    });
  } else {
    (definition.secretFields || []).forEach((field) => {
      if (hasValue(merged[field])) merged[field] = '********';
    });
    Object.keys(encryptedSecrets).forEach((field) => {
      merged[field] = '********';
    });
  }

  return merged;
}

function calculateStatus(provider, enabled, settings) {
  if (!enabled) return 'disabled';
  const definition = definitions[provider];
  const missing = (definition?.requiredFields || []).filter((field) => !hasValue(settings[field]) || settings[field] === '********');
  return missing.length === 0 ? 'configured' : 'needs_attention';
}

function applyRuntimeEnv(provider, settings) {
  const definition = definitions[provider];
  Object.entries(definition?.envMap || {}).forEach(([field, envKey]) => {
    if (hasValue(settings[field])) {
      process.env[envKey] = String(settings[field]);
    }
  });
}

function toSafeObject(doc) {
  const definition = definitions[doc.provider] || {};
  const settings = getEffectiveSettings(doc, { includeSecrets: false });
  const presentFields = getEffectiveSettings(doc, { includeSecrets: true });

  return {
    id: doc._id,
    provider: doc.provider,
    label: doc.label,
    category: doc.category,
    enabled: doc.enabled,
    settings,
    secretFields: definition.secretFields || doc.secretFields || [],
    requiredFields: definition.requiredFields || [],
    configuredFields: Object.keys(presentFields).filter((field) => hasValue(presentFields[field])),
    status: calculateStatus(doc.provider, doc.enabled, presentFields),
    lastTestedAt: doc.lastTestedAt,
    lastTestStatus: doc.lastTestStatus,
    lastTestMessage: doc.lastTestMessage,
    updatedAt: doc.updatedAt
  };
}

async function ensureIntegrationSettings() {
  const docs = [];
  for (const definition of Object.values(definitions)) {
    const envConfig = envSettings(definition);
    const publicSettings = {};
    const encryptedSecrets = {};

    Object.entries(envConfig).forEach(([field, value]) => {
      if (definition.secretFields.includes(field)) {
        encryptedSecrets[field] = encryptSecret(value);
      } else {
        publicSettings[field] = value;
      }
    });

    const existing = await IntegrationSetting.findOne({ provider: definition.provider });

    if (existing) {
      docs.push(existing);
      continue;
    }

    docs.push(await IntegrationSetting.create({
      provider: definition.provider,
      label: definition.label,
      category: definition.category,
      enabled: Object.keys(envConfig).length > 0,
      settings: publicSettings,
      encryptedSecrets,
      secretFields: definition.secretFields,
      status: calculateStatus(definition.provider, Object.keys(envConfig).length > 0, envConfig)
    }));
  }

  return docs;
}

async function listIntegrationSettings() {
  const docs = await ensureIntegrationSettings();
  return docs.map(toSafeObject).sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

async function updateIntegrationSetting(provider, payload, userId) {
  const definition = definitions[provider];
  if (!definition) {
    const error = new Error('Unknown integration provider');
    error.statusCode = 404;
    throw error;
  }

  const doc = await IntegrationSetting.findOne({ provider }) || new IntegrationSetting({
    provider,
    label: definition.label,
    category: definition.category,
    secretFields: definition.secretFields
  });

  const settings = mapToObject(doc.settings);
  const encryptedSecrets = mapToObject(doc.encryptedSecrets);
  const incoming = payload.settings || {};

  Object.entries(incoming).forEach(([field, value]) => {
    if (definition.secretFields.includes(field)) {
      if (hasValue(value) && value !== '********') {
        encryptedSecrets[field] = encryptSecret(value);
      }
      return;
    }

    if (value === null || value === undefined || value === '') {
      delete settings[field];
    } else {
      settings[field] = value;
    }
  });

  doc.enabled = Boolean(payload.enabled);
  doc.settings = settings;
  doc.encryptedSecrets = encryptedSecrets;
  doc.secretFields = definition.secretFields;
  doc.updatedBy = userId;
  const effectiveSettings = getEffectiveSettings(doc, { includeSecrets: true });
  doc.status = calculateStatus(provider, doc.enabled, effectiveSettings);
  await doc.save();
  applyRuntimeEnv(provider, effectiveSettings);

  return toSafeObject(doc);
}

async function testIntegrationSetting(provider) {
  const definition = definitions[provider];
  if (!definition) {
    const error = new Error('Unknown integration provider');
    error.statusCode = 404;
    throw error;
  }

  const doc = await IntegrationSetting.findOne({ provider });
  const effective = doc ? getEffectiveSettings(doc, { includeSecrets: true }) : envSettings(definition);
  const missing = definition.requiredFields.filter((field) => !hasValue(effective[field]));
  const passed = missing.length === 0;

  if (doc) {
    doc.lastTestedAt = new Date();
    doc.lastTestStatus = passed ? 'passed' : 'failed';
    doc.lastTestMessage = passed
      ? 'Required credentials are present. Live provider verification is ready for production credentials.'
      : `Missing required fields: ${missing.join(', ')}`;
    doc.status = calculateStatus(provider, doc.enabled, effective);
    await doc.save();
  }

  return {
    provider,
    passed,
    missing,
    message: passed
      ? 'Required credentials are present. Live provider verification is ready for production credentials.'
      : `Missing required fields: ${missing.join(', ')}`
  };
}

async function getIntegrationConfig(provider) {
  const definition = definitions[provider];
  if (!definition) return {};
  if (mongoose.connection.readyState !== 1) {
    return envSettings(definition);
  }
  const doc = await IntegrationSetting.findOne({ provider });
  return doc ? getEffectiveSettings(doc, { includeSecrets: true }) : envSettings(definition);
}

module.exports = {
  definitions,
  listIntegrationSettings,
  updateIntegrationSetting,
  testIntegrationSetting,
  getIntegrationConfig
};
