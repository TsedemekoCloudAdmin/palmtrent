const Booking = require('../models/Booking');
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceProvider = require('../models/InsuranceProvider');
const { recordAudit } = require('../services/auditService');

exports.issuePolicy = async (req, res) => {
  try {
    const { bookingId, providerId, coverageType = 'standard', premium, excess, documentUrl } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = booking.user.toString() === req.user.id || booking.shipper.toString() === req.user.id;
    if (!isOwner && req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const provider = providerId ? await InsuranceProvider.findById(providerId) : null;
    const cargoValue = booking.cargoDetails?.value || 0;
    const effectiveFrom = new Date();
    const expiresAt = new Date(effectiveFrom);
    expiresAt.setDate(expiresAt.getDate() + 30);

    const policy = await InsurancePolicy.create({
      booking: booking._id,
      provider: provider?._id,
      holder: booking.user,
      status: 'issued',
      coverageType,
      cargoValue,
      coverageAmount: cargoValue,
      premium: Number(premium || booking.insurance?.premium || 0),
      excess: Number(excess || 0),
      effectiveFrom,
      expiresAt,
      documentUrl,
      issuedBy: req.user.id,
      issuedAt: new Date()
    });

    booking.insurance = {
      ...booking.insurance,
      required: true,
      provider: provider?.code || booking.insurance?.provider,
      coverage: cargoValue,
      premium: policy.premium,
      policyNumber: policy.policyNumber
    };
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'insurance.policy_issued',
      entityType: 'InsurancePolicy',
      entityId: policy._id,
      entityRef: policy.policyNumber,
      req
    });

    res.status(201).json({ success: true, message: 'Policy issued', data: policy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to issue policy', error: error.message });
  }
};

exports.renewPolicy = async (req, res) => {
  try {
    const current = await InsurancePolicy.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Policy not found' });
    if (current.holder.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const effectiveFrom = new Date();
    const expiresAt = new Date(effectiveFrom);
    expiresAt.setDate(expiresAt.getDate() + Number(req.body.days || 30));

    const renewal = await InsurancePolicy.create({
      ...current.toObject(),
      _id: undefined,
      policyNumber: undefined,
      status: 'issued',
      premium: Number(req.body.premium || current.premium || 0),
      effectiveFrom,
      expiresAt,
      renewalOf: current._id,
      issuedBy: req.user.id,
      issuedAt: new Date()
    });

    current.status = 'renewed';
    await current.save();

    res.status(201).json({ success: true, message: 'Policy renewed', data: renewal });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to renew policy', error: error.message });
  }
};

exports.getMyPolicies = async (req, res) => {
  try {
    const query = req.user.userType === 'admin' ? {} : { holder: req.user.id };
    const policies = await InsurancePolicy.find(query).populate('booking', 'bookingReference').sort({ createdAt: -1 });
    res.json({ success: true, data: policies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch policies', error: error.message });
  }
};
