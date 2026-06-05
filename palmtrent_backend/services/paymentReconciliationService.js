const Payment = require('../models/Payment');
const openApiAfricaService = require('./openApiAfricaService');
const ecocashOpenApiService = require('./ecocashOpenApiService');

function summarizeStatus(results) {
  return results.reduce((summary, item) => {
    const key = item.status || 'unknown';
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}

async function reconcilePendingOpenApiPayments(options = {}) {
  const limit = Math.min(Number(options.limit || 25), 100);
  const minAgeMs = Number(options.minAgeMs || 60000);
  const cutoff = new Date(Date.now() - minAgeMs);

  const payments = await Payment.find({
    gateway: 'openapi_africa',
    paymentMethod: { $in: ['digital', 'ecocash', 'onemoney', 'card', 'bank_transfer', 'openapi_africa', 'clicknpay'] },
    status: { $in: ['pending', 'initiated', 'processing'] },
    createdAt: { $lte: cutoff },
    paymentReference: { $exists: true, $ne: '' }
  })
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(limit);

  const results = [];
  for (const payment of payments) {
    try {
      const result = await openApiAfricaService.checkAndUpdateStatus(payment.paymentReference);
      results.push({
        paymentReference: payment.paymentReference,
        status: result.status,
        rawStatus: result.rawStatus
      });
    } catch (error) {
      results.push({
        paymentReference: payment.paymentReference,
        status: 'failed_check',
        error: error.message
      });
    }
  }

  return {
    checked: payments.length,
    limit,
    minAgeMs,
    summary: summarizeStatus(results),
    results
  };
}

async function reconcileAllPendingPayments(options = {}) {
  const [openApiAfrica, ecocashAgent] = await Promise.all([
    reconcilePendingOpenApiPayments(options.openapiAfrica || options),
    ecocashOpenApiService.reconcilePendingCashAgentPayments(options.ecocashAgent || options)
  ]);

  return {
    openApiAfrica,
    ecocashAgent
  };
}

module.exports = {
  reconcilePendingOpenApiPayments,
  reconcileAllPendingPayments
};
