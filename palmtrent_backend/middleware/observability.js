const crypto = require('crypto');

const metrics = {
  startedAt: new Date(),
  requestsTotal: 0,
  responsesByStatus: {},
  responsesByRoute: {},
  errorsTotal: 0,
  totalResponseTimeMs: 0
};

function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const started = Date.now();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - started;
    const routeKey = `${req.method} ${req.route?.path || req.path}`;
    metrics.requestsTotal += 1;
    metrics.totalResponseTimeMs += durationMs;
    metrics.responsesByStatus[res.statusCode] = (metrics.responsesByStatus[res.statusCode] || 0) + 1;
    metrics.responsesByRoute[routeKey] = (metrics.responsesByRoute[routeKey] || 0) + 1;
    if (res.statusCode >= 500) metrics.errorsTotal += 1;

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](JSON.stringify({
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id,
      userType: req.user?.userType
    }));
  });

  next();
}

function getMetricsSnapshot() {
  const averageResponseTimeMs = metrics.requestsTotal
    ? Math.round(metrics.totalResponseTimeMs / metrics.requestsTotal)
    : 0;

  return {
    ...metrics,
    uptimeSeconds: Math.round(process.uptime()),
    averageResponseTimeMs,
    memory: process.memoryUsage()
  };
}

module.exports = {
  requestContext,
  getMetricsSnapshot
};
