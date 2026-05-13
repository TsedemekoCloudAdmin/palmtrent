const mongoose = require('mongoose');
const { getMetricsSnapshot } = require('../middleware/observability');
const { getIntegrationConfig } = require('../services/integrationSettingsService');

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
  const missing = [];
  ['JWT_SECRET', 'MONGODB_URI'].forEach(key => {
    if (!process.env[key]) missing.push(key);
  });

  const [paynowConfig, openApiAfricaConfig, mapboxConfig, whatsappConfig] = await Promise.all([
    getIntegrationConfig('paynow'),
    getIntegrationConfig('openapiAfrica'),
    getIntegrationConfig('mapbox'),
    getIntegrationConfig('whatsapp')
  ]);

  res.status(missing.length ? 503 : 200).json({
    success: missing.length === 0,
    ready: missing.length === 0,
    missing,
    paymentGatewayConfigured: Boolean(
      (paynowConfig.integrationId && paynowConfig.integrationKey) ||
      openApiAfricaConfig.publicUniqueId
    ),
    paynowConfigured: Boolean(paynowConfig.integrationId && paynowConfig.integrationKey),
    openApiAfricaConfigured: Boolean(openApiAfricaConfig.publicUniqueId),
    mapboxConfigured: Boolean(mapboxConfig.accessToken),
    whatsappConfigured: Boolean(whatsappConfig.phoneNumberId && whatsappConfig.accessToken && whatsappConfig.verifyToken)
  });
};
