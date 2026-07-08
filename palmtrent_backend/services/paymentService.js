// services/paymentService.js
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Subscription = require('../models/Subscription');
const Emergency = require('../models/Emergency');
const Payout = require('../models/Payout');
const escrowService = require('./escrowService');
const {
  assertPaymentTransition,
  isTerminalPaymentStatus,
  PAYMENT_STATUSES
} = require('./paymentStateMachine');

class PaymentService {
  
  /**
   * Create payment record for any payment method
   */
  async createPayment(bookingId, amount, paymentMethod, customer = {}) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const requestedAmount = Number(amount);
      const bookingAmount = Number(
        booking.totalAmount ||
        booking.pricing?.totals?.total ||
        booking.pricing?.total ||
        0
      );

      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        throw new Error('Payment amount must be a positive number');
      }

      if (bookingAmount > 0 && Math.abs(requestedAmount - bookingAmount) > 0.01) {
        throw new Error('Payment amount does not match the booking total');
      }

      // Determine gateway based on payment method
      const gateway = this.getGatewayForMethod(paymentMethod);
      
      // Agent/cash references should expire quickly to avoid stale unpaid bookings.
      const expiresAt = new Date();
      const shortExpiryMethods = ['cash_agent', 'cashViaAgent'];
      if (shortExpiryMethods.includes(paymentMethod)) {
        expiresAt.setHours(expiresAt.getHours() + 2);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 24);
      }

      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();

      const paymentData = {
        booking: bookingId,
        amount: bookingAmount > 0 ? bookingAmount : requestedAmount,
        currency: 'USD',
        paymentMethod,
        gateway,
        status: 'pending',
        customer,
        expiresAt,
        paymentReference: `PAY-${timestamp}-${random}`
      };

      const payment = await Payment.create(paymentData);

      // Update booking with payment reference
      booking.payment.reference = payment.paymentReference;
      await booking.save();

      return payment;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Get gateway for payment method
   */
  getGatewayForMethod(paymentMethod) {
    const gatewayMap = {
      'ecocash': 'openapi_africa',
      'onemoney': 'openapi_africa',
      'digital': 'openapi_africa',
      'card': 'openapi_africa',
      'bank_transfer': 'openapi_africa',
      'openapi_africa': 'openapi_africa',
      'clicknpay': 'openapi_africa',
      'corporate': 'none',
      'cash_agent': 'cash',
      'cash_on_pickup': 'cash',
      'cash_on_delivery': 'cash',
      'freight_allocation': 'none'
    };
    return gatewayMap[paymentMethod] || 'openapi_africa';
  }

  /**
   * Confirm payment (for all methods)
   */
  async confirmPayment(paymentReference, gatewayData = {}) {
    try {
      const payment = await Payment.findOne({ paymentReference });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === 'refunded') {
        throw new Error('Refunded payments cannot be confirmed again');
      }

      const confirmedAt = payment.confirmedAt || new Date();
      payment.status = 'confirmed';
      payment.confirmedAt = confirmedAt;
      
      if (gatewayData.gatewayReference) {
        payment.gatewayReference = gatewayData.gatewayReference;
      }
      if (gatewayData.metadata) {
        payment.metadata = { ...(payment.metadata || {}), ...gatewayData.metadata };
      }

      await payment.save();

      if (payment.subscription) {
        await this.finalizeConfirmedSubscriptionPayment(payment);
      } else if (payment.emergency) {
        await this.finalizeConfirmedEmergencyPayment(payment);
      } else if (payment.metadata?.purpose === 'commission') {
        await this.finalizeConfirmedCommissionPayment(payment);
      } else {
        await this.finalizeConfirmedBookingPayment(payment);
      }

      return payment;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(paymentReference, status, metadata = {}) {
    try {
      const payment = await Payment.findOne({ paymentReference });
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (status === 'confirmed') {
        return this.confirmPayment(paymentReference, { metadata });
      }

      if (isTerminalPaymentStatus(payment.status)) {
        payment.metadata = {
          ...(payment.metadata || {}),
          ignoredStatusUpdate: {
            status,
            metadata,
            ignoredAt: new Date()
          }
        };
        await payment.save();
        return payment;
      }

      assertPaymentTransition(payment.status, status);
      payment.status = status;
      
      if (status === PAYMENT_STATUSES.CONFIRMED) {
        payment.confirmedAt = new Date();
      } else if (status === PAYMENT_STATUSES.FAILED) {
        payment.failedAt = new Date();
      }

      if (Object.keys(metadata).length > 0) {
        payment.metadata = { ...payment.metadata, ...metadata };
      }

      await payment.save();

      if (payment.emergency) {
        await this.updateEmergencyPaymentStatus(payment);
      }

      return payment;
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  // A confirmed commission payment marks the booking's commission as paid so the
  // transporter can accept the cash job. It does NOT run the normal booking-payment
  // finalization (no re-broadcast / status change).
  async finalizeConfirmedCommissionPayment(payment) {
    const booking = await Booking.findById(payment.booking);
    if (!booking) return;
    booking.commission = {
      ...(booking.commission ? (booking.commission.toObject ? booking.commission.toObject() : booking.commission) : {}),
      required: true,
      status: 'paid',
      paidAt: payment.confirmedAt || new Date(),
      paymentReference: payment.paymentReference
    };
    await booking.save();
  }

  async finalizeConfirmedBookingPayment(payment) {
    const booking = await Booking.findById(payment.booking);
    if (!booking) {
      throw new Error('Booking not found for confirmed payment');
    }

    booking.payment = {
      ...(booking.payment || {}),
      status: 'confirmed',
      paidAt: booking.payment?.paidAt || payment.confirmedAt || new Date()
    };
    booking.paymentStatus = ['escrowed', 'released'].includes(booking.paymentStatus)
      ? booking.paymentStatus
      : 'confirmed';
    booking.paymentConfirmedAt = booking.paymentConfirmedAt || payment.confirmedAt || new Date();

    const shouldBroadcast = ['draft', 'pending_payment', 'pending', 'payment_confirmed'].includes(booking.status);
    if (shouldBroadcast) {
      booking.status = 'finding_transporter';
    }

    await booking.save();

    try {
      const escrow = await escrowService.createEscrow(payment._id, booking._id);
      console.log('Escrow created:', escrow.escrowReference);
    } catch (escrowError) {
      console.error('Error creating escrow:', escrowError);
    }

    await this.createShipmentFromBooking(booking._id);

    // The booking just became available. Broadcast it so eligible transporters
    // receive a push / in-app / WhatsApp "new job" alert. Without this, jobs
    // confirmed via the payment path silently appeared with no notification.
    if (shouldBroadcast) {
      try {
        const matchingService = require('./matchingService');
        await matchingService.findAndNotifyTransporters(booking._id);
      } catch (notifyError) {
        console.error('Error notifying transporters of new job:', notifyError);
      }
    }
  }

  async finalizeConfirmedSubscriptionPayment(payment) {
    const subscription = await Subscription.findById(payment.subscription);
    if (!subscription) {
      throw new Error('Subscription not found for confirmed payment');
    }

    subscription.payment = {
      ...(subscription.payment || {}),
      lastPayment: payment._id,
      status: 'paid',
      method: payment.paymentMethod,
      reference: payment.paymentReference
    };
    subscription.status = 'active';
    await subscription.save();
  }

  async finalizeConfirmedEmergencyPayment(payment) {
    const emergency = await Emergency.findById(payment.emergency);
    if (!emergency) {
      throw new Error('Emergency not found for confirmed payment');
    }

    const acceptedResponder = (emergency.response?.responders || []).find(item =>
      ['accepted', 'on_scene', 'completed'].includes(item.status) && item.user
    );

    emergency.billing = {
      ...(emergency.billing || {}),
      payment: payment._id,
      paymentReference: payment.paymentReference,
      paymentStatus: 'paid',
      paidAt: emergency.billing?.paidAt || payment.confirmedAt || new Date()
    };
    emergency.timeline.push({
      event: 'Roadside assistance payment confirmed',
      timestamp: new Date(),
      notes: `Payment ${payment.paymentReference} confirmed.`
    });
    await emergency.save();

    if (!acceptedResponder?.user) return;

    const providerEarnings = Number(
      emergency.billing?.providerEarnings ||
      payment.metadata?.providerEarnings ||
      payment.amount
    );

    if (!Number.isFinite(providerEarnings) || providerEarnings <= 0) return;

    await Payout.findOneAndUpdate(
      {
        recipient: acceptedResponder.user,
        sourceType: 'emergency',
        sourceId: emergency._id
      },
      {
        $setOnInsert: {
          recipient: acceptedResponder.user,
          sourceType: 'emergency',
          sourceId: emergency._id,
          amount: Number(providerEarnings.toFixed(2)),
          currency: payment.currency || 'USD',
          status: 'pending',
          metadata: {
            paymentReference: payment.paymentReference,
            emergencyType: emergency.emergencyType,
            platformFee: emergency.billing?.platformFee || payment.metadata?.platformFee || 0
          }
        }
      },
      { upsert: true, new: true }
    );
  }

  async updateEmergencyPaymentStatus(payment) {
    const statusMap = {
      pending: 'pending',
      initiated: 'initiated',
      processing: 'processing',
      failed: 'failed',
      cancelled: 'failed'
    };
    const paymentStatus = statusMap[payment.status];
    if (!paymentStatus) return;

    await Emergency.findByIdAndUpdate(payment.emergency, {
      $set: {
        'billing.payment': payment._id,
        'billing.paymentReference': payment.paymentReference,
        'billing.paymentStatus': paymentStatus
      }
    });
  }

  /**
   * Create shipment from booking
   */
  async createShipmentFromBooking(bookingId) {
    const Booking = require('../models/Booking');
    const Shipment = require('../models/Shipment');
    
    const booking = await Booking.findById(bookingId).populate('user');
    if (!booking) {
      console.error('Booking not found for shipment creation:', bookingId);
      return;
    }

    try {
      const existingShipment = await Shipment.findOne({ bookingReference: booking.bookingReference });
      if (existingShipment) {
        if (!existingShipment.booking) {
          existingShipment.booking = booking._id;
          await existingShipment.save();
        }
        booking.shipments = booking.shipments || [];
        if (!booking.shipments.some(shipmentId => shipmentId.toString() === existingShipment._id.toString())) {
          booking.shipments.push(existingShipment._id);
          await booking.save();
        }
        return existingShipment;
      }

      const shipmentData = {
        booking: booking._id,
        bookingReference: booking.bookingReference,
        shipper: booking.user._id,
        status: 'payment_confirmed',
        cargoDetails: booking.cargoDetails,
        route: booking.route,
        schedule: {
          pickupDate: booking.route.pickup.date,
          scheduledPickupTime: booking.route.pickup.date
        },
        pricing: booking.pricing,
        payment: {
          ...booking.payment,
          status: 'confirmed',
          paidAt: new Date()
        },
        insurance: booking.insurance,
        isCrossBorder: booking.crossBorder?.enabled || false,
        crossBorderDetails: booking.crossBorder,
        bookingType: booking.bookingType,
        multipleVehicles: booking.vehicles,
        coordination: booking.coordination
      };

      const shipment = await Shipment.create(shipmentData);
      console.log('Shipment created:', shipment._id);
      
      // Link shipment to booking
      booking.shipments.push(shipment._id);
      await booking.save();

      return shipment;
    } catch (error) {
      console.error('Error creating shipment:', error);
      throw error;
    }
  }

  /**
   * Get payment by reference
   */
  async getPaymentByReference(paymentReference) {
    return await Payment.findOne({ paymentReference }).populate('booking');
  }

  /**
   * Check if payment has expired
   */
  async checkPaymentExpiry(paymentReference) {
    const payment = await Payment.findOne({ paymentReference });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'pending' && payment.expiresAt < new Date()) {
      payment.status = 'cancelled';
      await payment.save();

      // Update booking status
      await Booking.findByIdAndUpdate(payment.booking, {
        status: 'cancelled'
      });

      return { expired: true, payment };
    }

    return { expired: false, payment };
  }
}

module.exports = new PaymentService();
