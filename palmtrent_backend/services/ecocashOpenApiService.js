const axios = require('axios');
const Payment = require('../models/Payment');
const paymentService = require('./paymentService');
const { getIntegrationConfig } = require('./integrationSettingsService');

const DEFAULT_BASE_URL = 'https://developers.ecocash.co.zw/api/ecocash_pay';
const STATUS_ENDPOINTS = {
  sandbox: '/api/v1/transaction/c2b/status/sandbox',
  live: '/api/v1/transaction/c2b/status'
};

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeMsisdn(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('263')) return digits;
  if (digits.startsWith('0')) return `263${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `263${digits}`;
  return digits;
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toUpperCase();
  if (['SUCCESS', 'PAID', 'COMPLETED', 'COMPLETE'].includes(value)) return 'confirmed';
  if (['FAILED', 'DECLINED', 'ERROR'].includes(value)) return 'failed';
  if (['CANCELLED', 'CANCELED', 'REVERSED'].includes(value)) return 'cancelled';
  return 'processing';
}

function getLookupReference(payment) {
  return payment?.metadata?.ecocashLookup?.sourceReference;
}

function getLookupPhone(payment) {
  return normalizeMsisdn(
    payment?.metadata?.ecocashLookup?.sourceMobileNumber ||
    payment?.customer?.phone ||
    payment?.metadata?.customerPhone ||
    payment?.metadata?.phoneNumber
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class EcocashOpenApiService {
  async getConfig() {
    const integrationConfig = await getIntegrationConfig('ecocashOpenApi');
    const mode = String(integrationConfig.mode || process.env.ECOCASH_OPENAPI_MODE || process.env.ECOCASH_MODE || 'sandbox').toLowerCase();
    const baseUrl = trimTrailingSlash(integrationConfig.baseUrl || process.env.ECOCASH_OPENAPI_BASE_URL || DEFAULT_BASE_URL);
    const endpoint = integrationConfig.statusEndpoint ||
      process.env.ECOCASH_OPENAPI_STATUS_ENDPOINT ||
      STATUS_ENDPOINTS[mode] ||
      STATUS_ENDPOINTS.sandbox;

    return {
      baseUrl,
      endpoint,
      apiKey: integrationConfig.apiKey || process.env.ECOCASH_OPENAPI_API_KEY || process.env.ECOCASH_API_KEY || '',
      bearerToken: integrationConfig.bearerToken || process.env.ECOCASH_OPENAPI_BEARER_TOKEN || process.env.ECOCASH_BEARER_TOKEN || '',
      merchantCode: integrationConfig.merchantCode || process.env.ECOCASH_MERCHANT_CODE || '',
      mode,
      timeoutMs: Number(integrationConfig.timeoutMs || process.env.ECOCASH_OPENAPI_TIMEOUT_MS || 30000),
      reconcileLimit: Number(integrationConfig.reconcileLimit || process.env.ECOCASH_RECONCILE_LIMIT || 20),
      reconcileMinIntervalMs: Number(integrationConfig.reconcileMinIntervalMs || process.env.ECOCASH_RECONCILE_MIN_INTERVAL_MS || 120000),
      reconcileDelayMs: Number(integrationConfig.reconcileDelayMs || process.env.ECOCASH_RECONCILE_DELAY_MS || 750)
    };
  }

  async isConfigured() {
    return Boolean((await this.getConfig()).apiKey);
  }

  buildHeaders(config) {
    const headers = {
      'X-API-KEY': config.apiKey,
      'Content-Type': 'application/json'
    };

    if (config.bearerToken) {
      headers.Authorization = `Bearer ${config.bearerToken}`;
    }

    return headers;
  }

  async lookupC2BStatus({ sourceMobileNumber, sourceReference }) {
    const config = await this.getConfig();
    if (!config.apiKey) {
      throw new Error('EcoCash Open API is not configured. Missing ECOCASH_OPENAPI_API_KEY.');
    }

    const mobileNumber = normalizeMsisdn(sourceMobileNumber);
    if (!mobileNumber) {
      throw new Error('EcoCash lookup requires a customer mobile number.');
    }

    if (!sourceReference) {
      throw new Error('EcoCash lookup requires a UUID source reference.');
    }

    const response = await axios.post(
      `${config.baseUrl}${config.endpoint}`,
      {
        sourceMobileNumber: mobileNumber,
        sourceReference
      },
      {
        headers: this.buildHeaders(config),
        timeout: config.timeoutMs
      }
    );

    return {
      status: normalizeStatus(response.data?.status || response.data?.transactionOperationStatus),
      rawStatus: response.data?.status || response.data?.transactionOperationStatus,
      sourceMobileNumber: mobileNumber,
      sourceReference,
      data: response.data
    };
  }

  async refreshCashAgentPayment(paymentOrReference, options = {}) {
    const payment = typeof paymentOrReference === 'string'
      ? await Payment.findOne({ paymentReference: paymentOrReference })
      : paymentOrReference;

    if (!payment) throw new Error('Payment not found');
    if (payment.paymentMethod !== 'cash_agent') {
      throw new Error('EcoCash agent lookup only applies to cash agent payments.');
    }

    const sourceReference = getLookupReference(payment);
    const sourceMobileNumber = getLookupPhone(payment);

    if (!sourceReference || !sourceMobileNumber) {
      payment.metadata = {
        ...(payment.metadata || {}),
        ecocashLookupLastError: {
          message: !sourceReference
            ? 'Missing EcoCash UUID lookup reference'
            : 'Missing customer mobile number for EcoCash lookup',
          checkedAt: new Date()
        }
      };
      await payment.save();
      return {
        status: payment.status,
        skipped: true,
        reason: payment.metadata.ecocashLookupLastError.message
      };
    }

    const lookup = await this.lookupC2BStatus({ sourceMobileNumber, sourceReference });
    const lookupAmount = Number(lookup.data?.amount?.amount);
    const lookupCurrency = lookup.data?.amount?.currency || payment.currency;
    const lookupReference = lookup.data?.ecocashReference;
    const expectedEcocashReference = options.expectedEcocashReference;
    const amountMatches = Number.isFinite(lookupAmount)
      ? Math.abs(lookupAmount - Number(payment.amount)) <= 0.50
      : false;
    const currencyMatches = !lookupCurrency || String(lookupCurrency).toUpperCase() === String(payment.currency || 'USD').toUpperCase();
    const referenceMatches = !expectedEcocashReference || lookupReference === expectedEcocashReference;

    const lookupMetadata = {
      ecocashLookupStatus: {
        ...lookup.data,
        checkedAt: new Date()
      }
    };

    if (lookup.status === 'confirmed') {
      if (!amountMatches) {
        await paymentService.updatePaymentStatus(payment.paymentReference, 'processing', {
          ...lookupMetadata,
          ecocashLookupLastError: {
            message: `EcoCash amount mismatch. Expected ${payment.amount}, received ${lookupAmount || 'unknown'}.`,
            checkedAt: new Date()
          }
        });
        return {
          status: 'processing',
          rawStatus: lookup.rawStatus,
          amountMatches: false,
          data: lookup.data
        };
      }

      if (!currencyMatches) {
        await paymentService.updatePaymentStatus(payment.paymentReference, 'processing', {
          ...lookupMetadata,
          ecocashLookupLastError: {
            message: `EcoCash currency mismatch. Expected ${payment.currency || 'USD'}, received ${lookupCurrency}.`,
            checkedAt: new Date()
          }
        });
        return {
          status: 'processing',
          rawStatus: lookup.rawStatus,
          currencyMatches: false,
          data: lookup.data
        };
      }

      if (!referenceMatches) {
        await paymentService.updatePaymentStatus(payment.paymentReference, 'processing', {
          ...lookupMetadata,
          ecocashLookupLastError: {
            message: `EcoCash reference mismatch. Expected ${expectedEcocashReference}, received ${lookupReference || 'unknown'}.`,
            checkedAt: new Date()
          }
        });
        return {
          status: 'processing',
          rawStatus: lookup.rawStatus,
          amountMatches: true,
          currencyMatches: true,
          referenceMatches: false,
          data: lookup.data
        };
      }

      if (payment.status !== 'confirmed') {
        await paymentService.confirmPayment(payment.paymentReference, {
          gatewayReference: lookup.data?.ecocashReference,
          metadata: {
            ...lookupMetadata,
            confirmedBy: 'ecocash_lookup',
            confirmedAmount: lookupAmount,
            customerPhone: lookup.data?.customerMsisdn || sourceMobileNumber,
            ecocashReference: lookup.data?.ecocashReference,
            transactionDateTime: lookup.data?.transactionDateTime
          }
        });
      }

      return {
        status: 'confirmed',
        rawStatus: lookup.rawStatus,
        amountMatches: true,
        currencyMatches: true,
        referenceMatches: true,
        data: lookup.data
      };
    }

    if (['failed', 'cancelled'].includes(lookup.status)) {
      await paymentService.updatePaymentStatus(payment.paymentReference, lookup.status, lookupMetadata);
    } else if (payment.status === 'pending') {
      await paymentService.updatePaymentStatus(payment.paymentReference, 'processing', lookupMetadata);
    } else {
      payment.metadata = {
        ...(payment.metadata || {}),
        ...lookupMetadata
      };
      await payment.save();
    }

    return {
      status: lookup.status,
      rawStatus: lookup.rawStatus,
      data: lookup.data
    };
  }

  async reconcilePendingCashAgentPayments(options = {}) {
    const config = await this.getConfig();
    if (!config.apiKey) {
      return {
        configured: false,
        checked: 0,
        confirmed: 0,
        failed: 0,
        cancelled: 0,
        processing: 0,
        skipped: 0,
        errors: [],
        message: 'EcoCash Open API is not configured'
      };
    }

    const now = new Date();
    const limit = Math.min(Number(options.limit || config.reconcileLimit || 20), 100);
    const minIntervalMs = Number(options.minIntervalMs || config.reconcileMinIntervalMs || 120000);
    const delayMs = Number(options.delayMs || config.reconcileDelayMs || 750);
    const cutoff = new Date(Date.now() - minIntervalMs);

    const payments = await Payment.find({
      paymentMethod: 'cash_agent',
      status: { $in: ['pending', 'initiated', 'processing'] },
      expiresAt: { $gt: now },
      'metadata.ecocashLookup.sourceReference': { $exists: true, $ne: '' },
      'metadata.ecocashLookup.sourceMobileNumber': { $exists: true, $ne: '' },
      $or: [
        { 'metadata.ecocashLookupStatus.checkedAt': { $exists: false } },
        { 'metadata.ecocashLookupStatus.checkedAt': { $lte: cutoff } },
        { 'metadata.ecocashLookupLastError.checkedAt': { $lte: cutoff } }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(limit);

    const results = {
      configured: true,
      checked: 0,
      confirmed: 0,
      failed: 0,
      cancelled: 0,
      processing: 0,
      skipped: 0,
      errors: [],
      limit,
      minIntervalMs,
      delayMs
    };

    for (const payment of payments) {
      try {
        const result = await this.refreshCashAgentPayment(payment);
        results.checked += 1;

        if (result.skipped) {
          results.skipped += 1;
        } else if (result.status === 'confirmed') {
          results.confirmed += 1;
        } else if (result.status === 'failed') {
          results.failed += 1;
        } else if (result.status === 'cancelled') {
          results.cancelled += 1;
        } else {
          results.processing += 1;
        }
      } catch (error) {
        results.errors.push({
          paymentReference: payment.paymentReference,
          message: error.message || 'EcoCash lookup failed'
        });

        payment.metadata = {
          ...(payment.metadata || {}),
          ecocashLookupLastError: {
            message: error.message || 'EcoCash lookup failed',
            checkedAt: new Date()
          }
        };
        await payment.save();
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }

    return results;
  }
}

module.exports = new EcocashOpenApiService();
module.exports.normalizeMsisdn = normalizeMsisdn;
module.exports.normalizeStatus = normalizeStatus;
