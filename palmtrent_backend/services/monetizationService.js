const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const CommissionRule = require('../models/CommissionRule');
const PlatformLedger = require('../models/PlatformLedger');
const Payout = require('../models/Payout');

const DEFAULT_RULES = [
  {
    code: 'shipment_digital_default',
    name: 'Shipment digital default',
    target: 'shipment',
    audience: 'all',
    paymentMethod: 'digital',
    platformFeeRate: 0.12,
    transporterCommissionRate: 0.15,
    minimumFee: 5,
    priority: 100
  },
  {
    code: 'shipment_openapi_default',
    name: 'Shipment OpenAPI Africa default',
    target: 'shipment',
    audience: 'all',
    paymentMethod: 'openapi_africa',
    platformFeeRate: 0.12,
    transporterCommissionRate: 0.15,
    minimumFee: 5,
    priority: 90
  },
  {
    code: 'shipment_cash_pickup_default',
    name: 'Shipment cash pickup default',
    target: 'shipment',
    audience: 'all',
    paymentMethod: 'cash_on_pickup',
    platformFeeRate: 0.15,
    transporterCommissionRate: 0.15,
    minimumFee: 5,
    priority: 80
  },
  {
    code: 'shipment_cash_delivery_default',
    name: 'Shipment cash delivery default',
    target: 'shipment',
    audience: 'all',
    paymentMethod: 'cash_on_delivery',
    platformFeeRate: 0.18,
    transporterCommissionRate: 0.15,
    minimumFee: 5,
    priority: 80
  },
  {
    code: 'shipment_corporate_default',
    name: 'Shipment corporate terms default',
    target: 'shipment',
    audience: 'corporate',
    paymentMethod: 'corporate',
    platformFeeRate: 0.10,
    transporterCommissionRate: 0.15,
    minimumFee: 5,
    priority: 70
  },
  {
    code: 'rental_default',
    name: 'Rental default',
    target: 'rental',
    audience: 'all',
    paymentMethod: 'all',
    rentalCommissionRate: 0.10,
    platformFeeRate: 0.10,
    minimumFee: 2,
    priority: 100
  }
];

const DEFAULT_PLANS = [
  {
    code: 'transporter_starter',
    name: 'Transporter Starter',
    audience: 'transporter',
    price: 15,
    billingCycle: 'monthly',
    features: ['Accept shipment jobs', 'Manage one vehicle', 'Basic earnings dashboard'],
    limits: { vehicles: 1, drivers: 1, monthlyBookings: 20, fleetAssets: 0, corporateSeats: 0, apiAccess: false, priorityMatching: false }
  },
  {
    code: 'transporter_growth',
    name: 'Transporter Growth',
    audience: 'transporter',
    price: 49,
    billingCycle: 'monthly',
    features: ['Manage fleet', 'Priority matching', 'Lower commission'],
    limits: { vehicles: 10, drivers: 10, monthlyBookings: 150, fleetAssets: 0, corporateSeats: 0, apiAccess: false, priorityMatching: true },
    commissionAdjustments: { shipmentCommissionDiscount: 0.03 }
  },
  {
    code: 'fleet_owner',
    name: 'Fleet Owner',
    audience: 'trailer_owner',
    price: 39,
    billingCycle: 'monthly',
    features: ['List fleet assets', 'Rental operations', 'Settlement dashboard'],
    limits: { vehicles: 0, drivers: 0, monthlyBookings: 0, fleetAssets: 15, corporateSeats: 0, apiAccess: false, priorityMatching: false }
  },
  {
    code: 'corporate_enterprise',
    name: 'Corporate Enterprise',
    audience: 'corporate',
    price: 99,
    billingCycle: 'monthly',
    features: ['Corporate bookings', 'Monthly invoices', 'API access', 'Team seats'],
    limits: { vehicles: 0, drivers: 0, monthlyBookings: 500, fleetAssets: 0, corporateSeats: 25, apiAccess: true, priorityMatching: true }
  }
];

function normalizePaymentMethod(method) {
  const value = String(method || 'digital').toLowerCase();
  if (['ecocash', 'onemoney', 'card', 'bank_transfer', 'clicknpay'].includes(value)) return 'digital';
  return value;
}

async function seedDefaults() {
  for (const rule of DEFAULT_RULES) {
    await CommissionRule.updateOne({ code: rule.code }, { $setOnInsert: rule }, { upsert: true });
  }
  for (const plan of DEFAULT_PLANS) {
    await Plan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
  }
}

async function getCommissionRule({ target, audience = 'all', paymentMethod = 'digital', accountTier = 'all' }) {
  await seedDefaults();
  const now = new Date();
  const normalizedMethod = normalizePaymentMethod(paymentMethod);
  const rules = await CommissionRule.find({
    target,
    enabled: true,
    audience: { $in: [audience, 'all'] },
    paymentMethod: { $in: [normalizedMethod, paymentMethod, 'all'] },
    accountTier: { $in: [accountTier, 'all'] },
    $and: [
      { $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
      { $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }] }
    ]
  }).sort({ priority: 1, updatedAt: -1 });

  return rules[0] || DEFAULT_RULES.find(rule => rule.target === target);
}

async function calculateShipmentFees(baseAmount, transporterGross, context = {}) {
  const rule = await getCommissionRule({
    target: 'shipment',
    audience: context.audience || 'all',
    paymentMethod: context.paymentMethod,
    accountTier: context.accountTier
  });
  const platformFee = Math.max(Number(rule.minimumFee || 0), baseAmount * Number(rule.platformFeeRate || 0));
  const transporterCommission = Math.max(Number(rule.minimumFee || 0), transporterGross * Number(rule.transporterCommissionRate || 0));
  return {
    rule,
    platformFee,
    platformFeeRate: Number(rule.platformFeeRate || 0),
    transporterCommission,
    transporterCommissionRate: Number(rule.transporterCommissionRate || 0)
  };
}

async function calculateRentalSettlement(rental) {
  const total = Number(rental.pricing?.total || 0);
  const deposit = Number(rental.pricing?.deposit || 0);
  const damageFees = Number(rental.pricing?.damageFees || 0);
  const lateFees = Number(rental.pricing?.lateFees || 0);
  const cleaningFees = Number(rental.pricing?.cleaningFees || 0);
  const extraKmFees = Number(rental.pricing?.extraKmFees || 0);
  const rule = await getCommissionRule({ target: 'rental', paymentMethod: rental.payment?.rentalPayment?.method || 'all' });
  const commissionRate = Number(rule.rentalCommissionRate || rule.platformFeeRate || 0);
  const usageCharges = damageFees + lateFees + cleaningFees + extraKmFees;
  const depositForfeited = Math.min(deposit, usageCharges);
  const renterRefund = Math.max(0, deposit - depositForfeited);
  const chargeable = Math.max(0, total - deposit);
  const platformFee = Math.max(Number(rule.minimumFee || 0), chargeable * commissionRate);
  const ownerEarnings = Math.max(0, chargeable - platformFee + depositForfeited);

  return {
    platformFeeRate: commissionRate,
    platformFee: Math.round(platformFee * 100) / 100,
    ownerEarnings: Math.round(ownerEarnings * 100) / 100,
    renterRefund,
    depositHeld: deposit,
    depositForfeited,
    commissionRule: rule._id,
    status: rental.status === 'completed' ? 'settled' : 'held',
    settledAt: rental.status === 'completed' ? new Date() : undefined
  };
}

async function recordLedgerEntry(entry) {
  return PlatformLedger.create(entry);
}

async function recordLedgerEntryOnce(match, entry) {
  const existing = await PlatformLedger.findOne(match);
  if (existing) return existing;
  return PlatformLedger.create(entry);
}

async function createPayout(data) {
  return Payout.create(data);
}

async function createPayoutOnce(match, data) {
  const existing = await Payout.findOne(match);
  if (existing) return existing;

  try {
    return await Payout.create(data);
  } catch (error) {
    if (error?.code === 11000) {
      const createdConcurrently = await Payout.findOne(match);
      if (createdConcurrently) return createdConcurrently;
    }
    throw error;
  }
}

async function listMonetizationSummary() {
  await seedDefaults();
  const [plans, commissionRules, subscriptions, ledgerSummary, payouts] = await Promise.all([
    Plan.find().sort({ audience: 1, sortOrder: 1, price: 1 }),
    CommissionRule.find().sort({ target: 1, priority: 1 }),
    Subscription.find().populate('user', 'fullName email userType').populate('plan').sort({ updatedAt: -1 }).limit(100),
    PlatformLedger.aggregate([
      { $match: { status: 'posted' } },
      { $group: { _id: { direction: '$direction', category: '$category' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]),
    Payout.find().populate('recipient', 'fullName email userType').sort({ createdAt: -1 }).limit(100)
  ]);

  return { plans, commissionRules, subscriptions, ledgerSummary, payouts };
}

module.exports = {
  seedDefaults,
  getCommissionRule,
  calculateShipmentFees,
  calculateRentalSettlement,
  recordLedgerEntry,
  recordLedgerEntryOnce,
  createPayout,
  createPayoutOnce,
  listMonetizationSummary
};
