const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const openApiAfricaService = require('./openApiAfricaService');
const monetizationService = require('./monetizationService');
const notificationService = require('./notificationService');
const { canConfirmRentalPayment, assertRentalTransition } = require('./paymentStateMachine');

async function calculateSettlement(rental) {
  return monetizationService.calculateRentalSettlement(rental);
}

function buildRentalCashReference(rental) {
  return `RNT-CASH-${rental.rentalReference || rental._id}`;
}

async function recordRentalCommissionLedger(rental, payment, metadata = {}) {
  if (!rental.settlement?.platformFee || rental.settlement.platformFee <= 0) return null;

  return monetizationService.recordLedgerEntryOnce(
    { sourceType: 'rental', sourceId: rental._id, category: 'commission', status: 'posted' },
    {
      sourceType: 'rental',
      sourceId: rental._id,
      user: rental.owner,
      direction: 'credit',
      category: 'commission',
      amount: rental.settlement.platformFee,
      currency: rental.pricing?.currency || payment?.currency || 'USD',
      status: 'posted',
      metadata: {
        rentalReference: rental.rentalReference,
        paymentReference: payment?.paymentReference || rental.payment?.paymentReference,
        commissionRule: rental.settlement.commissionRule,
        ...metadata
      }
    }
  );
}

async function notifyRentalPaymentConfirmed(rental, payment, source = 'payment') {
  await Promise.allSettled([
    rental.renter && notificationService.notify(
      rental.renter,
      'payment_received',
      'Rental payment confirmed',
      `Payment for rental ${rental.rentalReference} has been confirmed.`,
      {
        rentalId: rental._id.toString(),
        paymentReference: payment.paymentReference,
        source
      }
    ),
    rental.owner && notificationService.notify(
      rental.owner,
      'payment_received',
      'Rental payment confirmed',
      `Rental ${rental.rentalReference} is paid and ready for handover.`,
      {
        rentalId: rental._id.toString(),
        paymentReference: payment.paymentReference,
        source
      }
    )
  ]);
}

async function createRentalPayment(rentalId, customer = {}) {
  const rental = await Rental.findById(rentalId).populate('owner renter trailer vehicle');
  if (!rental) throw new Error('Rental not found');
  if (rental.renter._id.toString() !== customer.userId && rental.renter._id.toString() !== customer.user?._id?.toString()) {
    // API controller enforces ownership too; keep this permissive for server-side calls.
  }
  if (!['approved', 'payment_pending'].includes(rental.status)) {
    throw new Error('Rental must be approved before payment can be started');
  }

  let payment = rental.payment?.gatewayPayment
    ? await Payment.findById(rental.payment.gatewayPayment)
    : null;

  if (!payment) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    payment = await Payment.create({
      rental: rental._id,
      amount: rental.pricing.total,
      currency: rental.pricing.currency || 'USD',
      paymentMethod: 'openapi_africa',
      gateway: 'openapi_africa',
      status: 'pending',
      customer: {
        email: customer.email || rental.renter.email,
        phone: customer.phone || rental.renter.phone
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      paymentReference: `RNT-PAY-${timestamp}-${random}`
    });
  }

  const order = await openApiAfricaService.createPaymentOrder(payment, customer);

  rental.status = 'payment_pending';
  rental.payment.gatewayPayment = payment._id;
  rental.payment.paymentReference = payment.paymentReference;
  rental.payment.gateway = 'openapi_africa';
  rental.payment.rentalPayment.status = 'pending';
  rental.payment.rentalPayment.method = 'openapi_africa';
  rental.payment.rentalPayment.reference = payment.paymentReference;
  rental.payment.depositPayment.status = 'pending';
  rental.payment.depositPayment.method = 'openapi_africa';
  rental.payment.depositPayment.reference = payment.paymentReference;
  rental.statusHistory.push({
    status: 'payment_pending',
    changedBy: customer.userId || customer.user?._id,
    notes: 'Rental payment initiated through OpenAPI Africa'
  });
  await rental.save();

  return { payment, order, rental };
}

async function confirmRentalPayment(paymentReference, metadata = {}) {
  const payment = await Payment.findOne({ paymentReference });
  if (!payment) throw new Error('Payment not found');
  if (!payment.rental) throw new Error('Payment is not linked to a rental');

  payment.status = 'confirmed';
  payment.confirmedAt = new Date();
  payment.metadata = { ...payment.metadata, ...metadata };
  await payment.save();

  const rental = await Rental.findById(payment.rental);
  if (!rental) throw new Error('Rental not found');

  rental.status = 'confirmed';
  rental.payment.rentalPayment.status = 'paid';
  rental.payment.rentalPayment.paidAt = new Date();
  rental.payment.depositPayment.status = 'paid';
  rental.payment.depositPayment.paidAt = new Date();
  rental.payment.totalPaid = payment.amount;
  rental.payment.balance = 0;
  rental.settlement = {
    ...rental.settlement,
    ...await calculateSettlement(rental),
    status: 'held'
  };
  rental.statusHistory.push({
    status: 'confirmed',
    notes: 'Rental payment confirmed and funds held for settlement'
  });
  await rental.save();

  await recordRentalCommissionLedger(rental, payment, { paymentSource: metadata.source || 'gateway' });
  await notifyRentalPaymentConfirmed(rental, payment, metadata.source || 'gateway');

  return rental;
}

async function recordCashRentalPayment(rentalId, metadata = {}) {
  const rental = await Rental.findById(rentalId);
  if (!rental) throw new Error('Rental not found');

  const amount = Number(metadata.amount || rental.pricing?.total || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Rental amount is invalid');
  }

  const paymentReference = metadata.paymentReference || rental.payment?.paymentReference || buildRentalCashReference(rental);
  let payment = await Payment.findOne({ paymentReference });
  if (!payment) {
    payment = await Payment.create({
      rental: rental._id,
      user: rental.renter,
      amount,
      currency: rental.pricing?.currency || 'USD',
      paymentMethod: 'cash',
      gateway: 'cash',
      status: 'confirmed',
      customer: {
        email: rental.renterSnapshot?.email,
        phone: rental.renterSnapshot?.phone
      },
      paymentReference,
      confirmedAt: new Date(),
      metadata: {
        source: metadata.source || 'walk_in_cash',
        collectedBy: metadata.confirmedBy,
        note: metadata.note
      }
    });
  } else if (payment.status !== 'confirmed') {
    payment.status = 'confirmed';
    payment.confirmedAt = payment.confirmedAt || new Date();
    payment.metadata = { ...payment.metadata, ...metadata };
    await payment.save();
  }

  if (canConfirmRentalPayment(rental)) {
    assertRentalTransition(rental.status, 'confirmed');
    rental.status = metadata.status || 'confirmed';
  } else if (metadata.status && metadata.status !== rental.status) {
    assertRentalTransition(rental.status, metadata.status);
    rental.status = metadata.status;
  }
  rental.payment.gatewayPayment = payment._id;
  rental.payment.paymentReference = payment.paymentReference;
  rental.payment.gateway = 'cash';
  rental.payment.rentalPayment.status = 'paid';
  rental.payment.rentalPayment.method = 'cash';
  rental.payment.rentalPayment.reference = payment.paymentReference;
  rental.payment.rentalPayment.paidAt = rental.payment.rentalPayment.paidAt || new Date();
  rental.payment.depositPayment.status = 'paid';
  rental.payment.depositPayment.method = 'cash';
  rental.payment.depositPayment.reference = payment.paymentReference;
  rental.payment.depositPayment.paidAt = rental.payment.depositPayment.paidAt || new Date();
  rental.payment.totalPaid = Math.max(Number(rental.payment.totalPaid || 0), amount);
  rental.payment.balance = Math.max(0, Number(rental.pricing?.total || 0) - rental.payment.totalPaid);
  rental.settlement = {
    ...rental.settlement,
    ...await calculateSettlement(rental),
    status: 'held'
  };
  rental.statusHistory.push({
    status: rental.status,
    changedBy: metadata.confirmedBy,
    notes: metadata.note || 'Cash rental payment confirmed'
  });
  await rental.save();

  await recordRentalCommissionLedger(rental, payment, {
    paymentSource: metadata.source || 'cash',
    cashCollectedByOwner: true
  });
  await notifyRentalPaymentConfirmed(rental, payment, metadata.source || 'cash');

  return { rental, payment };
}

async function refreshRentalPaymentStatus(paymentReference) {
  await openApiAfricaService.checkAndUpdateStatus(paymentReference);
  const payment = await Payment.findOne({ paymentReference });
  if (payment?.status === 'confirmed') {
    return confirmRentalPayment(paymentReference, { source: 'status_check' });
  }
  return payment;
}

async function settleRental(rental) {
  const paymentMethod = rental.payment?.rentalPayment?.method || rental.payment?.depositPayment?.method;
  const isCashCollectedByOwner = paymentMethod === 'cash';

  rental.settlement = {
    ...rental.settlement,
    ...await calculateSettlement(rental),
    status: rental.status === 'disputed' ? 'disputed' : 'settled',
    settledAt: new Date(),
    cashCollectedByOwner: isCashCollectedByOwner
  };
  await rental.save();

  if (rental.settlement.ownerEarnings > 0 && !isCashCollectedByOwner) {
    const payout = await monetizationService.createPayoutOnce(
      { sourceType: 'rental', sourceId: rental._id, recipient: rental.owner },
      {
        recipient: rental.owner,
        sourceType: 'rental',
        sourceId: rental._id,
        amount: rental.settlement.ownerEarnings,
        currency: rental.pricing?.currency || 'USD',
        method: 'openapi_africa',
        status: 'pending',
        metadata: {
          rentalReference: rental.rentalReference,
          renterRefund: rental.settlement.renterRefund,
          depositForfeited: rental.settlement.depositForfeited
        }
      }
    );

    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'payout', sourceId: payout._id, category: 'payout', status: 'posted' },
      {
        sourceType: 'payout',
        sourceId: payout._id,
        user: rental.owner,
        direction: 'debit',
        category: 'payout',
        amount: payout.amount,
        currency: payout.currency,
        status: 'posted',
        metadata: { sourceType: 'rental', rental: rental._id, rentalReference: rental.rentalReference }
      }
    );
  } else if (isCashCollectedByOwner && rental.settlement.platformFee > 0) {
    await recordRentalCommissionLedger(rental, null, {
      paymentSource: 'cash',
      cashCollectedByOwner: true,
      settlementNote: 'Owner collected cash directly; platform commission remains payable by owner.'
    });
  }

  if (rental.settlement.renterRefund > 0) {
    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'rental', sourceId: rental._id, category: 'refund', status: 'posted' },
      {
        sourceType: 'rental',
        sourceId: rental._id,
        user: rental.renter,
        direction: 'debit',
        category: 'refund',
        amount: rental.settlement.renterRefund,
        currency: rental.pricing?.currency || 'USD',
        status: 'posted',
        metadata: { rentalReference: rental.rentalReference }
      }
    );
  }

  return rental;
}

module.exports = {
  createRentalPayment,
  confirmRentalPayment,
  recordCashRentalPayment,
  refreshRentalPaymentStatus,
  settleRental,
  calculateSettlement
};
