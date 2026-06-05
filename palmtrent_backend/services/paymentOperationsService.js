const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Subscription = require('../models/Subscription');
const Emergency = require('../models/Emergency');
const Payment = require('../models/Payment');
const { isAdmin } = require('./resourceAccessService');

const getCurrentUserId = (user) => user?._id || user?.id;

function parsePagination(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function applyPaymentFilters(query, filters = {}) {
  if (filters.status) query.status = filters.status;
  if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
  if (filters.gateway) query.gateway = filters.gateway;
  return query;
}

async function buildVisiblePaymentQuery(user, filters = {}) {
  const query = applyPaymentFilters({}, filters);

  if (isAdmin(user)) return query;

  const userId = getCurrentUserId(user);
  const canQuerySubscriptions = isObjectIdLike(userId);

  const [bookings, rentals, subscriptions, emergencies] = await Promise.all([
    Booking.find({
      $or: [
        { user: userId },
        { shipper: userId },
        { transporter: userId }
      ]
    }).select('_id'),
    Rental.find({
      $or: [
        { owner: userId },
        { renter: userId }
      ]
    }).select('_id'),
    canQuerySubscriptions
      ? Subscription.find({ user: userId }).select('_id')
      : Promise.resolve([]),
    Emergency.find({
      $or: [
        { triggeredBy: userId },
        { 'response.responders.user': userId }
      ]
    }).select('_id')
  ]);

  query.$or = [
    { booking: { $in: bookings.map(item => item._id) } },
    { rental: { $in: rentals.map(item => item._id) } }
  ];

  if (subscriptions.length) {
    query.$or.push({ subscription: { $in: subscriptions.map(item => item._id) } });
  }
  if (emergencies.length) {
    query.$or.push({ emergency: { $in: emergencies.map(item => item._id) } });
  }

  return query;
}

function serializePayment(payment) {
  return {
    ...payment,
    method: payment.paymentMethod
  };
}

async function listVisiblePayments(user, params = {}) {
  const { page, limit, skip } = parsePagination(params);
  const query = await buildVisiblePaymentQuery(user, params);

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('booking', 'bookingId bookingReference status route')
      .populate('rental', 'rentalReference status itemType')
      .populate('emergency', 'emergencyType status billing')
      .populate({ path: 'subscription', select: 'status amount currency payment plan', populate: { path: 'plan', select: 'name code audience billingCycle' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query)
  ]);

  return {
    count: payments.length,
    data: payments.map(serializePayment),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    query
  };
}

module.exports = {
  parsePagination,
  applyPaymentFilters,
  buildVisiblePaymentQuery,
  serializePayment,
  listVisiblePayments
};
