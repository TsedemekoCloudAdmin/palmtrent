const Booking = require('../models/Booking');
const Plan = require('../models/Plan');
const Rating = require('../models/Rating');
const Subscription = require('../models/Subscription');
const monetizationService = require('../services/monetizationService');

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

    if (plan.audience !== req.user.userType) {
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
      audience: plan.audience,
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

module.exports = {
  getLandingSummary,
  getPublicPlans,
  createMySubscription
};
