const mongoose = require('mongoose');
const { getMetricsSnapshot } = require('../middleware/observability');
const { definitions, getIntegrationConfig } = require('../services/integrationSettingsService');
const {
  getMissingEnv,
  getPlaceholderEnv,
  getConfigurationWarnings
} = require('../config/validateEnv');

exports.health = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(dbState === 1 ? 200 : 503).json({
    success: dbState === 1,
    status: dbState === 1 ? 'healthy' : 'degraded',
    requestId: req.requestId,
    database: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
};

exports.metrics = async (req, res) => {
  res.json({
    success: true,
    data: getMetricsSnapshot()
  });
};

exports.readiness = async (req, res) => {
  const production = process.env.NODE_ENV === 'production';
  const dbState = mongoose.connection.readyState;
  const missingEnv = getMissingEnv({ production });
  const placeholderEnv = getPlaceholderEnv({ production });
  const warnings = getConfigurationWarnings({ production });

  const providerNames = [
    'openapiAfrica',
    'paynow',
    'mapbox',
    'whatsapp',
    'email',
    'firebase',
    'uploadScanner',
    'storage'
  ];

  const configs = await Promise.all(providerNames.map(provider => getIntegrationConfig(provider)));
  const checks = {};
  const missingProviders = [];
  const productionRequiredProviders = new Set([
    'openapiAfrica',
    'mapbox',
    'whatsapp',
    'email',
    'firebase',
    'uploadScanner',
    'storage'
  ]);
  if (process.env.ENABLE_PAYNOW_DIRECT_RAIL === 'true') {
    productionRequiredProviders.add('paynow');
  }

  providerNames.forEach((provider, index) => {
    const definition = definitions[provider];
    const config = configs[index] || {};
    const missingFields = (definition.requiredFields || []).filter(field => {
      const value = config[field];
      return value === undefined || value === null || String(value).trim() === '';
    });

    if (provider === 'storage') {
      const driver = (config.driver || process.env.STORAGE_DRIVER || process.env.STORAGE_PROVIDER || 'local').toLowerCase();
      if (production && driver === 'local' && process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== 'true') {
        missingFields.push('nonLocalProductionStorage');
      }

      if (['s3', 'r2'].includes(driver)) {
        ['bucket', 'region', 'accessKeyId', 'secretAccessKey'].forEach(field => {
          if (!config[field]) missingFields.push(field);
        });
        if (driver === 'r2' && !config.endpoint) {
          missingFields.push('endpoint');
        }
      }
    }

    const configured = missingFields.length === 0;
    checks[provider] = {
      label: definition.label,
      configured,
      requiredInProduction: productionRequiredProviders.has(provider),
      missingFields: [...new Set(missingFields)]
    };

    if (!configured && productionRequiredProviders.has(provider)) {
      missingProviders.push(provider);
    }
  });

  const blockers = [
    ...missingEnv.map(key => `env:${key}`),
    ...placeholderEnv.map(key => `placeholder:${key}`),
    ...(dbState === 1 ? [] : ['database:connected']),
    ...(production ? missingProviders.map(provider => `provider:${provider}`) : [])
  ];

  const ready = blockers.length === 0;

  res.status(ready ? 200 : 503).json({
    success: ready,
    ready,
    environment: process.env.NODE_ENV || 'development',
    database: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown',
    blockers,
    missing: missingEnv,
    placeholders: placeholderEnv,
    warnings,
    checks,
    paymentGatewayConfigured: checks.openapiAfrica.configured,
    mobileMoneyRailConfigured: checks.openapiAfrica.configured || checks.paynow.configured,
    clicknPayConfigured: checks.openapiAfrica.configured,
    openApiAfricaConfigured: checks.openapiAfrica.configured,
    paynowDirectRailConfigured: checks.paynow.configured,
    ecocashConfigured: checks.openapiAfrica.configured || checks.paynow.configured,
    oneMoneyConfigured: checks.openapiAfrica.configured || checks.paynow.configured,
    mapboxConfigured: checks.mapbox.configured,
    whatsappConfigured: checks.whatsapp.configured,
    emailConfigured: checks.email.configured,
    firebaseConfigured: checks.firebase.configured,
    uploadScannerConfigured: checks.uploadScanner.configured,
    storageConfigured: checks.storage.configured
  });
};
