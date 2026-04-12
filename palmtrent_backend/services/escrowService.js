// services/escrowService.js
const Escrow = require('../models/Escrow');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

class EscrowService {

  /**
   * Create escrow when payment is confirmed
   */
  async createEscrow(paymentId, bookingId) {
    const payment = await Payment.findById(paymentId);
    const booking = await Booking.findById(bookingId).populate('shipper');

    if (!payment || !booking) {
      throw new Error('Payment or booking not found');
    }

    // Get commission rate based on payment method
    const commissionRate = Escrow.getCommissionRate(payment.paymentMethod);
    const platformFee = payment.amount * commissionRate;
    const transporterPayout = payment.amount - platformFee;

    const escrow = new Escrow({
      booking: bookingId,
      payment: paymentId,
      amount: payment.amount,
      platformFee,
      transporterPayout,
      currency: payment.currency || 'USD',
      commissionRate,
      paymentMethod: payment.paymentMethod,
      shipper: booking.shipper._id || booking.shipper,
      status: 'held',
      heldAt: new Date()
    });

    await escrow.save();

    // Update booking with escrow reference
    booking.escrow = escrow._id;
    booking.paymentStatus = 'escrowed';
    await booking.save();

    return escrow;
  }

  /**
   * Assign transporter to escrow when matched
   */
  async assignTransporter(escrowId, transporterId) {
    const escrow = await Escrow.findById(escrowId);

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    escrow.transporter = transporterId;
    await escrow.save();

    return escrow;
  }

  /**
   * Confirm delivery and start grace period
   */
  async confirmDelivery(bookingId) {
    const escrow = await Escrow.findOne({ booking: bookingId });

    if (!escrow) {
      throw new Error('Escrow not found for this booking');
    }

    if (escrow.status !== 'held') {
      throw new Error(`Cannot confirm delivery. Escrow status is: ${escrow.status}`);
    }

    escrow.releaseConditions.deliveryConfirmed = true;
    escrow.setGracePeriod();
    escrow.status = 'pending_release';

    await escrow.save();

    return escrow;
  }

  /**
   * Raise a dispute on escrow
   */
  async raiseDispute(bookingId, userId, reason, description) {
    const escrow = await Escrow.findOne({ booking: bookingId });

    if (!escrow) {
      throw new Error('Escrow not found for this booking');
    }

    if (!['held', 'pending_release'].includes(escrow.status)) {
      throw new Error('Cannot raise dispute on this escrow');
    }

    escrow.raiseDispute(userId, reason, description);
    await escrow.save();

    return escrow;
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(escrowId, resolution, resolvedInFavorOf, splitPercentage = null) {
    const escrow = await Escrow.findById(escrowId);

    if (!escrow || escrow.status !== 'disputed') {
      throw new Error('Disputed escrow not found');
    }

    escrow.dispute.resolution = resolution;
    escrow.dispute.resolvedAt = new Date();

    switch (resolvedInFavorOf) {
      case 'shipper':
        escrow.dispute.status = 'resolved_shipper';
        // Full refund to shipper
        return this.processRefund(escrowId, escrow.amount, 'Dispute resolved in favor of shipper');

      case 'transporter':
        escrow.dispute.status = 'resolved_transporter';
        escrow.releaseConditions.noActiveDispute = true;
        escrow.status = 'pending_release';
        break;

      case 'split':
        escrow.dispute.status = 'resolved_split';
        // Partial refund based on split percentage
        const refundAmount = escrow.amount * (splitPercentage / 100);
        await this.processPartialRefund(escrowId, refundAmount, 'Dispute resolved with split');
        break;
    }

    await escrow.save();
    return escrow;
  }

  /**
   * Process full refund
   */
  async processRefund(escrowId, amount, reason) {
    const escrow = await Escrow.findById(escrowId);

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    escrow.status = 'refunded';
    escrow.refundedAt = new Date();
    escrow.refund = {
      amount,
      reason,
      processedAt: new Date()
    };

    await escrow.save();

    // Update booking status
    await Booking.findByIdAndUpdate(escrow.booking, {
      paymentStatus: 'refunded',
      status: 'cancelled'
    });

    // TODO: Trigger actual refund via payment gateway

    return escrow;
  }

  /**
   * Process partial refund (for split resolutions)
   */
  async processPartialRefund(escrowId, refundAmount, reason) {
    const escrow = await Escrow.findById(escrowId);

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    escrow.status = 'partially_refunded';
    escrow.refund = {
      amount: refundAmount,
      reason,
      processedAt: new Date()
    };

    // Recalculate transporter payout
    escrow.transporterPayout = escrow.amount - escrow.platformFee - refundAmount;

    await escrow.save();

    return escrow;
  }

  /**
   * Release funds to transporter (called by cron job or manually)
   */
  async releaseFunds(escrowId) {
    const escrow = await Escrow.findById(escrowId).populate('transporter');

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (!escrow.canRelease() && escrow.status !== 'pending_release') {
      throw new Error('Escrow is not ready for release');
    }

    // Check grace period has expired
    if (escrow.gracePeriodEndsAt && new Date() < escrow.gracePeriodEndsAt) {
      throw new Error('Grace period has not expired yet');
    }

    escrow.releaseConditions.gracePeriodExpired = true;
    escrow.status = 'released';
    escrow.releasedAt = new Date();

    await escrow.save();

    // Update booking
    await Booking.findByIdAndUpdate(escrow.booking, {
      paymentStatus: 'released'
    });

    // TODO: Trigger actual payout to transporter via payment gateway

    return escrow;
  }

  /**
   * Process scheduled releases (called by cron job)
   */
  async processScheduledReleases() {
    const readyEscrows = await Escrow.findReadyForRelease();
    const results = [];

    for (const escrow of readyEscrows) {
      try {
        const released = await this.releaseFunds(escrow._id);
        results.push({ escrowId: escrow._id, status: 'released' });
      } catch (error) {
        results.push({ escrowId: escrow._id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * Cancel booking before transporter assignment - full refund
   */
  async cancelBeforeMatch(bookingId) {
    const escrow = await Escrow.findOne({ booking: bookingId });

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.transporter) {
      throw new Error('Transporter already assigned. Use cancellation with penalty.');
    }

    return this.processRefund(escrow._id, escrow.amount, 'Cancelled before transporter match');
  }

  /**
   * Cancel booking after transporter assignment - partial refund
   */
  async cancelAfterMatch(bookingId, cancellationFeePercentage = 20) {
    const escrow = await Escrow.findOne({ booking: bookingId });

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    const cancellationFee = escrow.amount * (cancellationFeePercentage / 100);
    const refundAmount = escrow.amount - cancellationFee;

    escrow.status = 'partially_refunded';
    escrow.refundedAt = new Date();
    escrow.refund = {
      amount: refundAmount,
      reason: `Cancelled after match. ${cancellationFeePercentage}% cancellation fee applied.`,
      processedAt: new Date()
    };

    await escrow.save();

    // Update booking
    await Booking.findByIdAndUpdate(escrow.booking, {
      paymentStatus: 'partially_refunded',
      status: 'cancelled'
    });

    return escrow;
  }

  /**
   * Get escrow by booking ID
   */
  async getEscrowByBooking(bookingId) {
    return Escrow.findOne({ booking: bookingId })
      .populate('booking')
      .populate('payment')
      .populate('transporter', 'name email phone')
      .populate('shipper', 'name email phone');
  }

  /**
   * Get escrow summary for dashboard
   */
  async getEscrowSummary() {
    const summary = await Escrow.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalPlatformFee: { $sum: '$platformFee' },
          totalTransporterPayout: { $sum: '$transporterPayout' }
        }
      }
    ]);

    return summary;
  }

  /**
   * Record cash collection by transporter
   */
  async recordCashCollection(bookingId, collectedAmount, collectionType) {
    const escrow = await Escrow.findOne({ booking: bookingId });

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (!['cash_on_pickup', 'cash_on_delivery'].includes(escrow.paymentMethod)) {
      throw new Error('This booking is not a cash payment');
    }

    // For cash payments, transporter collects full amount and remits platform fee later
    escrow.metadata = {
      ...escrow.metadata,
      cashCollected: true,
      collectedAmount,
      collectionType,
      collectedAt: new Date()
    };

    await escrow.save();

    return escrow;
  }
}

module.exports = new EscrowService();
