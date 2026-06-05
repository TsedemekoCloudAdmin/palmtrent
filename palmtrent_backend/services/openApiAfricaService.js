const axios = require('axios');
const Payment = require('../models/Payment');
const paymentService = require('./paymentService');
const { getIntegrationConfig } = require('./integrationSettingsService');

const DEFAULT_BASE_URL = 'https://backendservices.clicknpay.africa:2081';

class OpenApiAfricaService {
  async getConfig() {
    const config = await getIntegrationConfig('openapiAfrica');
    const defaultReturnUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/payment/return`
      : 'http://localhost:3000/payment/return';
    return {
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      publicUniqueId: config.publicUniqueId,
      currency: config.currency || 'USD',
      returnUrl: config.returnUrl || defaultReturnUrl,
      customerCharged: config.customerCharged !== false,
      multiplePayments: config.multiplePayments === true
    };
  }

  async createOrder(paymentReference, customer = {}) {
    const payment = await Payment.findOne({ paymentReference })
      .populate('booking')
      .populate({ path: 'subscription', populate: { path: 'plan' } });
    if (!payment) throw new Error('Payment not found');

    const config = await this.getConfig();
    if (!config.publicUniqueId) {
      throw new Error('OpenAPI Africa is not configured. Missing public unique ID.');
    }

    const amount = Number(payment.amount || 0);
    const payload = {
      channel: 'AUTOMATED',
      clientReference: payment.paymentReference,
      currency: payment.currency || config.currency,
      customerCharged: config.customerCharged,
      customerPhoneNumber: customer.phone || payment.customer?.phone || '',
      description: payment.subscription
        ? `Palmtrent subscription ${payment.subscription.plan?.name || payment.paymentReference}`
        : `Palmtrent freight booking ${payment.booking?.bookingReference || payment.paymentReference}`,
      multiplePayments: config.multiplePayments,
      amount,
      totalAmount: amount,
      orderType: 'DYNAMIC',
      orderYpe: 'DYNAMIC',
      productsList: [{
        description: payment.subscription ? 'Palmtrent subscription payment' : 'Palmtrent freight booking payment',
        id: 1,
        price: amount,
        productName: payment.subscription ? 'Palmtrent Subscription' : 'Freight Booking',
        quantity: 1
      }],
      publicUniqueId: config.publicUniqueId,
      returnUrl: config.returnUrl
    };

    const response = await axios.post(`${config.baseUrl}/payme/orders`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    payment.status = 'initiated';
    payment.initiatedAt = new Date();
    payment.gateway = 'openapi_africa';
    payment.gatewayReference = response.data.openapiGatewayReference || response.data.paymentGatewayReference || response.data.id;
    payment.pollUrl = `${config.baseUrl}/payme/orders/top-paid/${encodeURIComponent(payment.paymentReference)}`;
    payment.metadata = {
      ...payment.metadata,
      openApiAfricaOrder: response.data
    };
    await payment.save();

    return {
      success: true,
      paymentReference: payment.paymentReference,
      redirectUrl: response.data.paymeURL,
      gatewayReference: payment.gatewayReference,
      raw: response.data
    };
  }

  async createPaymentOrder(payment, customer = {}) {
    const config = await this.getConfig();
    if (!config.publicUniqueId) {
      throw new Error('OpenAPI Africa is not configured. Missing public unique ID.');
    }

    const amount = Number(payment.amount || 0);
    const referenceLabel = payment.booking?.bookingReference ||
      payment.rental?.rentalReference ||
      payment.subscription?.plan?.name ||
      payment.paymentReference;
    const payload = {
      channel: 'AUTOMATED',
      clientReference: payment.paymentReference,
      currency: payment.currency || config.currency,
      customerCharged: config.customerCharged,
      customerPhoneNumber: customer.phone || payment.customer?.phone || '',
      description: `Palmtrent payment ${referenceLabel}`,
      multiplePayments: config.multiplePayments,
      amount,
      totalAmount: amount,
      orderType: 'DYNAMIC',
      orderYpe: 'DYNAMIC',
      productsList: [{
        description: payment.subscription
          ? 'Palmtrent subscription payment'
          : payment.rental
            ? 'Palmtrent fleet rental payment'
            : 'Palmtrent freight booking payment',
        id: 1,
        price: amount,
        productName: payment.subscription ? 'Palmtrent Subscription' : payment.rental ? 'Fleet Rental' : 'Freight Booking',
        quantity: 1
      }],
      publicUniqueId: config.publicUniqueId,
      returnUrl: config.returnUrl
    };

    const response = await axios.post(`${config.baseUrl}/payme/orders`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    payment.status = 'initiated';
    payment.initiatedAt = new Date();
    payment.gateway = 'openapi_africa';
    payment.gatewayReference = response.data.openapiGatewayReference || response.data.paymentGatewayReference || response.data.id;
    payment.pollUrl = `${config.baseUrl}/payme/orders/top-paid/${encodeURIComponent(payment.paymentReference)}`;
    payment.metadata = {
      ...payment.metadata,
      openApiAfricaOrder: response.data
    };
    await payment.save();

    return {
      success: true,
      paymentReference: payment.paymentReference,
      redirectUrl: response.data.paymeURL,
      gatewayReference: payment.gatewayReference,
      raw: response.data
    };
  }

  mapStatus(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'SUCCESS' || normalized === 'PAID') return 'confirmed';
    if (normalized === 'FAILED') return 'failed';
    if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'cancelled';
    return 'processing';
  }

  async checkAndUpdateStatus(paymentReference) {
    const payment = await Payment.findOne({ paymentReference });
    if (!payment) throw new Error('Payment not found');

    const config = await this.getConfig();
    const response = await axios.get(
      `${config.baseUrl}/payme/orders/top-paid/${encodeURIComponent(paymentReference)}`,
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const mappedStatus = this.mapStatus(response.data.status);
    const gatewayMetadata = {
      gatewayReference: response.data.paymentGatewayReference || response.data.openapiGatewayReference,
      metadata: { openApiAfricaStatus: response.data }
    };

    if (payment.rental) {
      if (mappedStatus === 'confirmed' && payment.status !== 'confirmed') {
        payment.status = 'confirmed';
        payment.confirmedAt = new Date();
        payment.gatewayReference = gatewayMetadata.gatewayReference || payment.gatewayReference;
        payment.metadata = {
          ...payment.metadata,
          openApiAfricaStatus: response.data
        };
        await payment.save();
      } else if (['failed', 'cancelled', 'processing'].includes(mappedStatus) && payment.status !== mappedStatus) {
        payment.status = mappedStatus;
        payment.gatewayReference = gatewayMetadata.gatewayReference || payment.gatewayReference;
        payment.metadata = {
          ...payment.metadata,
          openApiAfricaStatus: response.data
        };
        await payment.save();
      }

      return {
        status: mappedStatus,
        rawStatus: response.data.status,
        data: response.data
      };
    }

    if (payment.subscription) {
      if (mappedStatus === 'confirmed' && payment.status !== 'confirmed') {
        await paymentService.confirmPayment(paymentReference, gatewayMetadata);
      } else if (['failed', 'cancelled', 'processing'].includes(mappedStatus) && payment.status !== mappedStatus) {
        payment.status = mappedStatus;
        payment.gatewayReference = gatewayMetadata.gatewayReference || payment.gatewayReference;
        payment.metadata = {
          ...payment.metadata,
          openApiAfricaStatus: response.data
        };
        await payment.save();
      }

      return {
        status: mappedStatus,
        rawStatus: response.data.status,
        data: response.data
      };
    }

    if (mappedStatus === 'confirmed' && payment.status !== 'confirmed') {
      await paymentService.confirmPayment(paymentReference, {
        gatewayReference: gatewayMetadata.gatewayReference,
        metadata: gatewayMetadata.metadata
      });
    } else if (['failed', 'cancelled'].includes(mappedStatus) && payment.status !== mappedStatus) {
      await paymentService.updatePaymentStatus(paymentReference, mappedStatus, {
        openApiAfricaStatus: response.data
      });
    } else if (mappedStatus === 'processing' && payment.status === 'initiated') {
      await paymentService.updatePaymentStatus(paymentReference, 'processing', {
        openApiAfricaStatus: response.data
      });
    }

    return {
      status: mappedStatus,
      rawStatus: response.data.status,
      data: response.data
    };
  }
}

module.exports = new OpenApiAfricaService();
