const Booking = require('../models/Booking');
const Plan = require('../models/Plan');
const Rating = require('../models/Rating');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const monetizationService = require('../services/monetizationService');
const paymentService = require('../services/paymentService');

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'past_due', 'suspended'];

function getPeriodEnd(start, billingCycle) {
  const end = new Date(start);
  if (billingCycle === 'annual') end.setFullYear(end.getFullYear() + 1);
  else if (billingCycle === 'quarterly') end.setMonth(end.getMonth() + 3);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

function serializePlan(plan) {
  return {
    id: plan._id,
    code: plan.code,
    name: plan.name,
    audience: plan.audience,
    description: plan.description,
    billingCycle: plan.billingCycle,
    price: plan.price,
    currency: plan.currency,
    trialDays: 0,
    features: plan.features || [],
    limits: plan.limits || {},
    active: plan.active,
    sortOrder: plan.sortOrder
  };
}

function isPlanCompatibleWithUser(planAudience, userType) {
  if (planAudience === userType) return true;
  return planAudience === 'trailer_owner' && userType === 'transporter';
}

async function getPublicPlans(req, res) {
  try {
    await monetizationService.seedDefaults();
    const plans = await Plan.find({ active: true })
      .sort({ audience: 1, sortOrder: 1, price: 1, name: 1 });

    res.json({
      success: true,
      data: plans.map(serializePlan)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load subscription plans',
      error: error.message
    });
  }
}

async function getLandingSummary(req, res) {
  try {
    await monetizationService.seedDefaults();

    const User = require('../models/User');
    const [transporterCount, completedDeliveryCount, ratingAgg, plans] = await Promise.all([
      User.countDocuments({ userType: 'transporter', status: 'active' }),
      Booking.countDocuments({ status: { $in: ['delivered', 'completed'] } }),
      Rating.aggregate([
        { $match: { visibility: 'visible' } },
        { $group: { _id: null, average: { $avg: '$overallRating' }, count: { $sum: 1 } } }
      ]),
      Plan.find({ active: true }).sort({ audience: 1, sortOrder: 1, price: 1, name: 1 })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          activeTransporters: transporterCount,
          completedDeliveries: completedDeliveryCount,
          averageRating: ratingAgg[0]?.average ? Number(ratingAgg[0].average.toFixed(1)) : 0,
          ratingCount: ratingAgg[0]?.count || 0
        },
        plans: plans.map(serializePlan)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load landing page data',
      error: error.message
    });
  }
}

async function createMySubscription(req, res) {
  try {
    const { planId, planCode } = req.body;
    const plan = await Plan.findOne({
      active: true,
      ...(planId ? { _id: planId } : { code: planCode })
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }

    if (!isPlanCompatibleWithUser(plan.audience, req.user.userType)) {
      return res.status(409).json({
        success: false,
        message: `This plan is for ${plan.audience.replace('_', ' ')} accounts.`
      });
    }

    const now = new Date();
    const periodEnd = getPeriodEnd(now, plan.billingCycle);
    const subscriptionData = {
      user: req.user._id,
      corporateAccount: req.user.corporateAccount,
      plan: plan._id,
      audience: req.user.userType,
      status: 'active',
      billingCycle: plan.billingCycle,
      amount: plan.price,
      currency: plan.currency,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      trialEndsAt: undefined,
      payment: {
        status: plan.price > 0 ? 'pending' : 'not_required'
      },
      seats: {
        included: plan.limits?.corporateSeats || 1,
        used: 1
      },
      metadata: {
        source: 'public_landing'
      }
    };

    const subscription = await Subscription.findOneAndUpdate(
      {
        user: req.user._id,
        status: { $in: ACTIVE_SUBSCRIPTION_STATUSES }
      },
      { $set: subscriptionData },
      { new: true, upsert: true, runValidators: true }
    ).populate('plan');

    res.status(201).json({
      success: true,
      message: plan.price > 0
        ? 'Subscription selected. Payment is pending confirmation.'
        : 'Subscription activated.',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    });
  }
}

async function createSubscriptionPayment(req, res) {
  try {
    const { id } = req.params;
    const { paymentMethod = 'clicknpay', customer = {} } = req.body;

    const subscription = await Subscription.findOne({
      _id: id,
      user: req.user._id,
      status: { $in: ACTIVE_SUBSCRIPTION_STATUSES }
    }).populate('plan');

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (subscription.amount <= 0 || subscription.payment?.status === 'not_required') {
      subscription.payment = {
        ...(subscription.payment || {}),
        status: 'not_required'
      };
      await subscription.save();
      return res.json({
        success: true,
        message: 'This subscription does not require payment.',
        data: {
          subscription,
          paymentRequired: false
        }
      });
    }

    if (subscription.payment?.status === 'paid') {
      return res.json({
        success: true,
        message: 'Subscription payment is already confirmed.',
        data: {
          subscription,
          paymentRequired: false
        }
      });
    }

    const existingPayment = subscription.payment?.reference
      ? await Payment.findOne({
          subscription: subscription._id,
          paymentReference: subscription.payment.reference,
          status: { $in: ['pending', 'initiated', 'processing'] }
        })
      : null;

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    const payment = existingPayment || await Payment.create({
      subscription: subscription._id,
      paymentReference: `PAY-${timestamp}-${random}`,
      amount: subscription.amount,
      currency: subscription.currency || 'USD',
      paymentMethod,
      gateway: paymentService.getGatewayForMethod(paymentMethod),
      status: 'pending',
      customer: {
        email: customer.email || req.user.email,
        phone: customer.phone || req.user.phone
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        type: 'subscription',
        planCode: subscription.plan?.code,
        planName: subscription.plan?.name
      }
    });

    subscription.payment = {
      ...(subscription.payment || {}),
      status: 'pending',
      method: payment.paymentMethod,
      reference: payment.paymentReference,
      lastPayment: payment._id
    };
    await subscription.save();

    res.status(existingPayment ? 200 : 201).json({
      success: true,
      message: 'Subscription payment created. Complete payment to activate platform access.',
      data: {
        subscription,
        paymentRequired: true,
        paymentId: payment._id,
        paymentReference: payment.paymentReference,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        expiresAt: payment.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create subscription payment'
    });
  }
}

async function getMySubscription(req, res) {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ACTIVE_SUBSCRIPTION_STATUSES }
    }).populate('plan');

    res.json({
      success: true,
      data: subscription || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load subscription',
      error: error.message
    });
  }
}

module.exports = {
  getLandingSummary,
  getPublicPlans,
  createMySubscription,
  createSubscriptionPayment,
  getMySubscription,
  isPlanCompatibleWithUser
};
