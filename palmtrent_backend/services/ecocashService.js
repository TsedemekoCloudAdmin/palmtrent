// services/ecocashService.js
const { Paynow } = require("paynow");
const Payment = require('../models/Payment');
const { getIntegrationConfig } = require('./integrationSettingsService');

class EcoCashService {
  constructor() {
    this.paynow = null;
    this.init();
  }

  init() {
    if (!process.env.PAYNOW_INTEGRATION_ID || !process.env.PAYNOW_INTEGRATION_KEY) {
      console.warn('EcoCash Service: Paynow credentials not configured');
      return;
    }

    this.paynow = new Paynow(
      process.env.PAYNOW_INTEGRATION_ID,
      process.env.PAYNOW_INTEGRATION_KEY
    );

    this.paynow.resultUrl = process.env.PAYNOW_RESULT_URL || "http://localhost:3000/api/payments/webhook";
    this.paynow.returnUrl = process.env.PAYNOW_RETURN_URL || "http://localhost:3000/payment/return";

    if (process.env.NODE_ENV === 'development') {
      this.paynow.debug = true;
    }
  }

  async refreshPaynowClient() {
    const config = await getIntegrationConfig('paynow');
    if (!config.integrationId || !config.integrationKey) {
      this.paynow = null;
      return null;
    }

    this.paynow = new Paynow(config.integrationId, config.integrationKey);
    this.paynow.resultUrl = config.resultUrl || process.env.PAYNOW_RESULT_URL || "http://localhost:3000/api/payments/webhook";
    this.paynow.returnUrl = config.returnUrl || process.env.PAYNOW_RETURN_URL || "http://localhost:3000/payment/return";
    if (process.env.NODE_ENV === 'development') {
      this.paynow.debug = true;
    }
    return this.paynow;
  }

  /**
   * Format phone number for EcoCash
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;

    let formatted = phone.replace(/[\s-]/g, '');

    // Convert to Zimbabwe international format
    if (formatted.startsWith('0')) {
      formatted = `263${formatted.substring(1)}`;
    } else if (formatted.startsWith('+263')) {
      formatted = formatted.substring(1);
    } else if (!formatted.startsWith('263')) {
      formatted = `263${formatted}`;
    }

    return formatted;
  }

  /**
   * Validate EcoCash phone number
   */
  validateEcoCashNumber(phone) {
    const formatted = this.formatPhoneNumber(phone);
    if (!formatted) return { valid: false, error: 'Phone number is required' };

    // EcoCash numbers start with 077 or 078
    const ecoCashPattern = /^263(77|78)\d{7}$/;

    if (!ecoCashPattern.test(formatted)) {
      return {
        valid: false,
        error: 'Invalid EcoCash number. Must start with 077 or 078'
      };
    }

    return { valid: true, formatted };
  }

  /**
   * Initiate EcoCash payment via Paynow
   */
  async initiatePayment(paymentReference, amount, phoneNumber, email) {
    await this.refreshPaynowClient();
    if (!this.paynow) {
      throw new Error('EcoCash service not configured. Missing Paynow credentials.');
    }

    // Validate phone number
    const validation = this.validateEcoCashNumber(phoneNumber);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const formattedPhone = validation.formatted;

    // Create Paynow payment
    const payment = this.paynow.createPayment(paymentReference, email);
    payment.add('Palmtrent Freight Booking', amount);

    console.log('Initiating EcoCash payment:', {
      reference: paymentReference,
      amount,
      phone: formattedPhone
    });

    try {
      // Send to mobile money (EcoCash)
      const response = await this.paynow.sendMobile(payment, formattedPhone, 'ecocash');

      console.log('EcoCash response:', response);

      if (response.success) {
        return {
          success: true,
          pollUrl: response.pollUrl,
          instructions: response.instructions || 'Please check your phone and enter your EcoCash PIN to confirm the payment',
          gatewayReference: response.id,
          status: 'initiated'
        };
      } else {
        return {
          success: false,
          error: response.error || 'EcoCash payment initiation failed',
          status: 'failed'
        };
      }
    } catch (error) {
      console.error('EcoCash initiation error:', error);
      throw error;
    }
  }

  /**
   * Poll payment status
   */
  async pollStatus(pollUrl) {
    await this.refreshPaynowClient();
    if (!this.paynow) {
      throw new Error('EcoCash service not configured');
    }

    try {
      const status = await this.paynow.pollTransaction(pollUrl);

      console.log('EcoCash poll status:', status);

      return {
        paid: status.paid(),
        cancelled: status.cancelled(),
        status: this.mapPaynowStatus(status),
        reference: status.reference
      };
    } catch (error) {
      console.error('EcoCash poll error:', error);
      throw error;
    }
  }

  /**
   * Map Paynow status to our status
   */
  mapPaynowStatus(paynowStatus) {
    if (paynowStatus.paid()) return 'confirmed';
    if (paynowStatus.cancelled()) return 'cancelled';
    if (paynowStatus.awaitingDelivery()) return 'processing';
    if (paynowStatus.delivered()) return 'processing';
    if (paynowStatus.pending()) return 'pending';
    return 'unknown';
  }

  /**
   * Process EcoCash payment for a booking
   */
  async processPayment(paymentId) {
    const payment = await Payment.findById(paymentId).populate('booking');

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.paymentMethod !== 'ecocash') {
      throw new Error('Payment is not an EcoCash payment');
    }

    if (!payment.customer?.phone) {
      throw new Error('Customer phone number is required for EcoCash');
    }

    const result = await this.initiatePayment(
      payment.paymentReference,
      payment.amount,
      payment.customer.phone,
      payment.customer.email || 'noreply@palmtrent.com'
    );

    if (result.success) {
      payment.status = 'initiated';
      payment.initiatedAt = new Date();
      payment.pollUrl = result.pollUrl;
      payment.gatewayReference = result.gatewayReference;
      payment.metadata = {
        ...payment.metadata,
        ecocashInstructions: result.instructions
      };
      await payment.save();
    } else {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.metadata = {
        ...payment.metadata,
        failureReason: result.error
      };
      await payment.save();
    }

    return {
      ...result,
      paymentReference: payment.paymentReference
    };
  }

  /**
   * Check and update payment status
   */
  async checkAndUpdateStatus(paymentReference) {
    const payment = await Payment.findOne({ paymentReference });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (!payment.pollUrl) {
      return {
        status: payment.status,
        message: 'No poll URL available'
      };
    }

    const pollResult = await this.pollStatus(payment.pollUrl);

    if (pollResult.paid && payment.status !== 'confirmed') {
      // Payment confirmed - this will trigger escrow creation via paymentService
      const paymentService = require('./paymentService');
      await paymentService.confirmPayment(paymentReference, {
        gatewayReference: pollResult.reference,
        metadata: { ecocashPollResult: pollResult }
      });

      return {
        status: 'confirmed',
        message: 'Payment confirmed successfully'
      };
    } else if (pollResult.cancelled && payment.status !== 'cancelled') {
      payment.status = 'cancelled';
      await payment.save();

      return {
        status: 'cancelled',
        message: 'Payment was cancelled'
      };
    }

    return {
      status: payment.status,
      pollResult
    };
  }

  /**
   * Get EcoCash payment instructions
   */
  getPaymentInstructions(phoneNumber) {
    return {
      steps: [
        'You will receive a prompt on your phone',
        'Enter your EcoCash PIN to authorize the payment',
        'Wait for confirmation message',
        'Payment will be confirmed automatically'
      ],
      phone: this.formatPhoneNumber(phoneNumber),
      timeout: '5 minutes',
      support: 'If you do not receive a prompt, please check your EcoCash balance and try again'
    };
  }
}

module.exports = new EcoCashService();
