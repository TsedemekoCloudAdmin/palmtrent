// services/paymentService.js
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const escrowService = require('./escrowService');

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
        amount,
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
      'ecocash': 'paynow',
      'onemoney': 'paynow',
      'digital': 'openapi_africa',
      'card': 'openapi_africa',
      'bank_transfer': 'openapi_africa',
      'openapi_africa': 'openapi_africa',
      'clicknpay': 'openapi_africa',
      'corporate': 'none',
      'cash_agent': 'cash',
      'cash_on_pickup': 'cash',
      'cash_on_delivery': 'cash'
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

      payment.status = 'confirmed';
      payment.confirmedAt = new Date();
      
      if (gatewayData.gatewayReference) {
        payment.gatewayReference = gatewayData.gatewayReference;
      }
      if (gatewayData.metadata) {
        payment.metadata = gatewayData.metadata;
      }

      await payment.save();

      // Update booking status
      await Booking.findByIdAndUpdate(payment.booking, {
        'payment.status': 'confirmed',
        'payment.paidAt': new Date(),
        paymentStatus: 'confirmed',
        paymentConfirmedAt: new Date(),
        status: 'finding_transporter'
      });

      // Create escrow to hold funds
      try {
        const escrow = await escrowService.createEscrow(payment._id, payment.booking);
        console.log('Escrow created:', escrow.escrowReference);
      } catch (escrowError) {
        console.error('Error creating escrow:', escrowError);
        // Don't fail the payment confirmation if escrow creation fails
      }

      // Create shipment
      await this.createShipmentFromBooking(payment.booking);

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

      payment.status = status;
      
      if (status === 'confirmed') {
        payment.confirmedAt = new Date();
      } else if (status === 'failed') {
        payment.failedAt = new Date();
      }

      if (Object.keys(metadata).length > 0) {
        payment.metadata = { ...payment.metadata, ...metadata };
      }

      await payment.save();

      // Update booking if payment is confirmed
      if (status === 'confirmed') {
        await Booking.findByIdAndUpdate(payment.booking, {
          'payment.status': 'confirmed',
          'payment.paidAt': new Date(),
          paymentStatus: 'confirmed',
          paymentConfirmedAt: new Date(),
          status: 'finding_transporter'
        });

        // Create escrow to hold funds
        try {
          const escrow = await escrowService.createEscrow(payment._id, payment.booking);
          console.log('Escrow created:', escrow.escrowReference);
        } catch (escrowError) {
          console.error('Error creating escrow:', escrowError);
        }

        await this.createShipmentFromBooking(payment.booking);
      }

      return payment;
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
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
      const shipmentData = {
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
