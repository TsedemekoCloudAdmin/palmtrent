const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const openApiAfricaService = require('./openApiAfricaService');
const monetizationService = require('./monetizationService');

async function calculateSettlement(rental) {
  return monetizationService.calculateRentalSettlement(rental);
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

  if (rental.settlement?.platformFee > 0) {
    await monetizationService.recordLedgerEntryOnce(
      { sourceType: 'rental', sourceId: rental._id, category: 'commission', status: 'posted' },
      {
        sourceType: 'rental',
        sourceId: rental._id,
        user: rental.owner,
        direction: 'credit',
        category: 'commission',
        amount: rental.settlement.platformFee,
        currency: rental.pricing?.currency || payment.currency || 'USD',
        status: 'posted',
        metadata: {
          rentalReference: rental.rentalReference,
          paymentReference: payment.paymentReference,
          commissionRule: rental.settlement.commissionRule
        }
      }
    );
  }

  return rental;
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
  rental.settlement = {
    ...rental.settlement,
    ...await calculateSettlement(rental),
    status: rental.status === 'disputed' ? 'disputed' : 'settled',
    settledAt: new Date()
  };
  await rental.save();

  if (rental.settlement.ownerEarnings > 0) {
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
  refreshRentalPaymentStatus,
  settleRental,
  calculateSettlement
};
