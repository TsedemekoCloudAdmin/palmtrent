const Plan = require('../models/Plan');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const CommissionRule = require('../models/CommissionRule');
const PlatformLedger = require('../models/PlatformLedger');
const Payout = require('../models/Payout');
const monetizationService = require('../services/monetizationService');
const { recordAudit } = require('../services/auditService');

async function recordSubscriptionRevenue(subscription) {
  if (subscription.amount <= 0 || subscription.payment?.status !== 'paid') return;
  await monetizationService.recordLedgerEntryOnce(
    { sourceType: 'subscription', sourceId: subscription._id, category: 'subscription_fee', status: 'posted' },
    {
      sourceType: 'subscription',
      sourceId: subscription._id,
      user: subscription.user,
      direction: 'credit',
      category: 'subscription_fee',
      amount: subscription.amount,
      currency: subscription.currency || 'USD',
      status: 'posted',
      metadata: {
        plan: subscription.plan?._id || subscription.plan,
        billingCycle: subscription.billingCycle,
        paymentReference: subscription.payment?.reference
      }
    }
  );
}

exports.getMonetizationOverview = async (req, res) => {
  try {
    const data = await monetizationService.listMonetizationSummary();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load monetization overview', error: error.message });
  }
};

exports.upsertPlan = async (req, res) => {
  try {
    const payload = { ...req.body, updatedBy: req.user._id };
    if (!payload.code) return res.status(400).json({ success: false, message: 'Plan code is required' });
    const plan = await Plan.findOneAndUpdate(
      { code: payload.code },
      { $set: payload, $setOnInsert: { createdBy: req.user._id } },
      { new: true, upsert: true, runValidators: true }
    );
    await recordAudit({ actor: req.user, action: 'monetization.plan_upserted', entityType: 'Plan', entityId: plan._id, metadata: { code: plan.code }, req });
    res.json({ success: true, data: plan, message: 'Plan saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save plan', error: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    await recordAudit({ actor: req.user, action: 'monetization.plan_updated', entityType: 'Plan', entityId: plan._id, req });
    res.json({ success: true, data: plan, message: 'Plan updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update plan', error: error.message });
  }
};

exports.upsertCommissionRule = async (req, res) => {
  try {
    const payload = { ...req.body, updatedBy: req.user._id };
    if (!payload.code) return res.status(400).json({ success: false, message: 'Commission rule code is required' });
    const rule = await CommissionRule.findOneAndUpdate(
      { code: payload.code },
      { $set: payload, $setOnInsert: { createdBy: req.user._id } },
      { new: true, upsert: true, runValidators: true }
    );
    await recordAudit({ actor: req.user, action: 'monetization.commission_rule_upserted', entityType: 'CommissionRule', entityId: rule._id, metadata: { code: rule.code }, req });
    res.json({ success: true, data: rule, message: 'Commission rule saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save commission rule', error: error.message });
  }
};

exports.updateCommissionRule = async (req, res) => {
  try {
    const rule = await CommissionRule.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: 'Commission rule not found' });
    await recordAudit({ actor: req.user, action: 'monetization.commission_rule_updated', entityType: 'CommissionRule', entityId: rule._id, req });
    res.json({ success: true, data: rule, message: 'Commission rule updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update commission rule', error: error.message });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const plan = await Plan.findById(req.body.plan);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const user = await User.findById(req.body.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.billingCycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else if (plan.billingCycle === 'quarterly') periodEnd.setMonth(periodEnd.getMonth() + 3);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const currentPeriodStart = req.body.currentPeriodStart ? new Date(req.body.currentPeriodStart) : now;
    const currentPeriodEnd = req.body.currentPeriodEnd ? new Date(req.body.currentPeriodEnd) : periodEnd;
    const nextBillingAt = req.body.nextBillingAt ? new Date(req.body.nextBillingAt) : currentPeriodEnd;
    const amount = req.body.amount !== undefined ? Number(req.body.amount) : plan.price;
    const payment = req.body.payment || {};

    const subscription = await Subscription.create({
      user: user._id,
      corporateAccount: req.body.corporateAccount || user.corporateAccount,
      plan: plan._id,
      audience: req.body.audience || plan.audience,
      status: req.body.status || (plan.trialDays > 0 ? 'trialing' : 'active'),
      billingCycle: req.body.billingCycle || plan.billingCycle,
      amount,
      currency: req.body.currency || plan.currency,
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingAt,
      trialEndsAt: req.body.trialEndsAt
        ? new Date(req.body.trialEndsAt)
        : plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined,
      payment: {
        status: payment.status || (amount > 0 ? 'pending' : 'not_required'),
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined
      },
      seats: {
        included: Number(req.body.seats?.included || plan.limits?.corporateSeats || 1),
        used: Number(req.body.seats?.used || 1),
        extraSeatPrice: Number(req.body.seats?.extraSeatPrice || 0)
      },
      metadata: {
        ...(req.body.metadata || {}),
        source: 'admin_console',
        assignedBy: req.user._id
      }
    });
    if (subscription.payment?.status === 'paid') {
      await recordSubscriptionRevenue(subscription);
    }
    await recordAudit({ actor: req.user, action: 'monetization.subscription_created', entityType: 'Subscription', entityId: subscription._id, req });
    res.status(201).json({ success: true, data: subscription, message: 'Subscription created' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create subscription', error: error.message });
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('plan user');
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });
    await recordSubscriptionRevenue(subscription);
    await recordAudit({ actor: req.user, action: 'monetization.subscription_updated', entityType: 'Subscription', entityId: subscription._id, req });
    res.json({ success: true, data: subscription, message: 'Subscription updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update subscription', error: error.message });
  }
};

exports.recordLedgerEntry = async (req, res) => {
  try {
    const entry = await PlatformLedger.create(req.body);
    await recordAudit({ actor: req.user, action: 'monetization.ledger_entry_recorded', entityType: 'PlatformLedger', entityId: entry._id, req });
    res.status(201).json({ success: true, data: entry, message: 'Ledger entry recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record ledger entry', error: error.message });
  }
};

exports.createPayout = async (req, res) => {
  try {
    const payout = await Payout.create(req.body);
    await recordAudit({ actor: req.user, action: 'monetization.payout_created', entityType: 'Payout', entityId: payout._id, req });
    res.status(201).json({ success: true, data: payout, message: 'Payout created' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create payout', error: error.message });
  }
};

exports.updatePayout = async (req, res) => {
  try {
    const payoutToUpdate = await Payout.findById(req.params.id);
    if (!payoutToUpdate) return res.status(404).json({ success: false, message: 'Payout not found' });

    const immutableFields = ['recipient', 'sourceType', 'sourceId', 'amount', 'currency'];
    const immutableUpdate = immutableFields.find(field => Object.prototype.hasOwnProperty.call(req.body, field));
    if (immutableUpdate) {
      return res.status(400).json({
        success: false,
        message: `Payout ${immutableUpdate} cannot be changed after creation`
      });
    }

    const updates = { ...req.body };
    if (updates.status) {
      const allowedTransitions = {
        pending: ['approved', 'processing', 'failed', 'cancelled'],
        approved: ['processing', 'paid', 'failed', 'cancelled'],
        processing: ['paid', 'failed', 'cancelled'],
        failed: [],
        cancelled: [],
        paid: []
      };
      if (updates.status !== payoutToUpdate.status && !allowedTransitions[payoutToUpdate.status]?.includes(updates.status)) {
        return res.status(409).json({
          success: false,
          message: `Cannot change payout status from ${payoutToUpdate.status} to ${updates.status}`
        });
      }
    }

    if (updates.status === 'approved') {
      updates.approvedBy = req.user._id;
      updates.approvedAt = new Date();
    }
    if (updates.status === 'paid') updates.paidAt = new Date();
    const payout = await Payout.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    await recordAudit({ actor: req.user, action: 'monetization.payout_updated', entityType: 'Payout', entityId: payout._id, req });
    res.json({ success: true, data: payout, message: 'Payout updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update payout', error: error.message });
  }
};
