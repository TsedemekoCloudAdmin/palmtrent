// services/escrowService.js
const Escrow = require('../models/Escrow');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const monetizationService = require('./monetizationService');

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

    const existingEscrow = await Escrow.findOne({ booking: bookingId, payment: paymentId });
    if (existingEscrow) return existingEscrow;

    const pricing = booking.pricing || {};
    const monetizationFees = pricing.totals?.platformTotal || pricing.breakdown?.platformFee
      ? null
      : await monetizationService.calculateShipmentFees(payment.amount, payment.amount, {
        audience: booking.corporateAccount ? 'corporate' : 'all',
        paymentMethod: payment.paymentMethod
      });
    const platformFee = Number(
      pricing.totals?.platformTotal ||
      pricing.breakdown?.platformFee ||
      monetizationFees?.platformFee ||
      0
    );
    const transporterPayout = Number(
      pricing.totals?.transporterTotal ||
      Math.max(0, payment.amount - platformFee)
    );
    const commissionRate = payment.amount > 0 ? platformFee / payment.amount : 0;

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

    try {
      await escrow.save();
    } catch (error) {
      if (error?.code === 11000) {
        const createdByConcurrentConfirmation = await Escrow.findOne({
          booking: bookingId,
          payment: paymentId
        });
        if (createdByConcurrentConfirmation) return createdByConcurrentConfirmation;
      }
      throw error;
    }

    await this.recordShipmentLedger(booking, payment, escrow);

    // Update booking with escrow reference
    booking.escrow = escrow._id;
    booking.paymentStatus = 'escrowed';
    await booking.save();

    return escrow;
  }

  async recordShipmentLedger(booking, payment, escrow) {
    const platformFee = Number(booking.pricing?.breakdown?.platformFee || escrow.platformFee || 0);
    const transporterCommission = Number(booking.pricing?.breakdown?.transporterCommission || 0);
    const baseMetadata = {
      bookingReference: booking.bookingReference,
      paymentReference: payment.paymentReference,
      escrowReference: escrow.escrowReference,
      paymentMethod: payment.paymentMethod
    };

    if (platformFee > 0) {
      await monetizationService.recordLedgerEntryOnce(
        { sourceType: 'booking', sourceId: booking._id, category: 'platform_fee', status: 'posted' },
        {
          sourceType: 'booking',
          sourceId: booking._id,
          user: booking.shipper,
          direction: 'credit',
          category: 'platform_fee',
          amount: platformFee,
          currency: payment.currency || 'USD',
          status: 'posted',
          metadata: baseMetadata
        }
      );
    }

    if (transporterCommission > 0) {
      await monetizationService.recordLedgerEntryOnce(
        { sourceType: 'booking', sourceId: booking._id, category: 'commission', status: 'posted' },
        {
          sourceType: 'booking',
          sourceId: booking._id,
          user: booking.transporter,
          direction: 'credit',
          category: 'commission',
          amount: transporterCommission,
          currency: payment.currency || 'USD',
          status: 'posted',
          metadata: baseMetadata
        }
      );
    }
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

    if (escrow.status === 'disputed') {
      return escrow;
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

    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'booking', sourceId: escrow.booking, category: 'refund', status: 'posted' },
      {
        sourceType: 'booking',
        sourceId: escrow.booking,
        user: escrow.shipper,
        direction: 'debit',
        category: 'refund',
        amount,
        currency: escrow.currency || 'USD',
        status: 'posted',
        metadata: { escrowReference: escrow.escrowReference, reason }
      }
    );

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

    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'booking', sourceId: escrow.booking, category: 'refund', status: 'posted' },
      {
        sourceType: 'booking',
        sourceId: escrow.booking,
        user: escrow.shipper,
        direction: 'debit',
        category: 'refund',
        amount: refundAmount,
        currency: escrow.currency || 'USD',
        status: 'posted',
        metadata: { escrowReference: escrow.escrowReference, reason }
      }
    );

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

    await this.ensureReleasedEscrowPayout(escrow);

    return escrow;
  }

  async ensureReleasedEscrowPayout(escrow) {
    if (!escrow?.transporter || Number(escrow.transporterPayout || 0) <= 0) {
      return null;
    }

    const payout = await monetizationService.createPayoutOnce(
      { sourceType: 'booking', sourceId: escrow.booking, recipient: escrow.transporter },
      {
        recipient: escrow.transporter,
        sourceType: 'booking',
        sourceId: escrow.booking,
        amount: escrow.transporterPayout,
        currency: escrow.currency || 'USD',
        method: 'openapi_africa',
        status: 'pending',
        metadata: { escrowReference: escrow.escrowReference }
      }
    );

    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'payout', sourceId: payout._id, category: 'payout', status: 'posted' },
      {
        sourceType: 'payout',
        sourceId: payout._id,
        user: escrow.transporter,
        direction: 'debit',
        category: 'payout',
        amount: payout.amount,
        currency: payout.currency,
        status: 'posted',
        metadata: { sourceType: 'booking', booking: escrow.booking, escrowReference: escrow.escrowReference }
      }
    );

    return payout;
  }

  async backfillReleasedEscrowPayouts() {
    const releasedEscrows = await Escrow.find({
      status: 'released',
      transporter: { $exists: true, $ne: null },
      transporterPayout: { $gt: 0 }
    });
    const results = [];

    for (const escrow of releasedEscrows) {
      try {
        const payout = await this.ensureReleasedEscrowPayout(escrow);
        results.push({ escrowId: escrow._id, payoutId: payout?._id, status: payout ? 'ensured' : 'skipped' });
      } catch (error) {
        results.push({ escrowId: escrow._id, status: 'failed', error: error.message });
      }
    }

    return results;
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
