// controllers/claimsController.js
const InsuranceClaim = require('../models/InsuranceClaim');
const Booking = require('../models/Booking');
const { recordAudit } = require('../services/auditService');
const { assertBookingTransition } = require('../services/flowControlService');
const escrowService = require('../services/escrowService');
const { finalizeUploadedFiles } = require('../services/uploadFinalizationService');

function mapDisputeCategoryToIncident(category) {
  const map = {
    payment_issue: 'other',
    service_quality: 'other',
    unprofessional_conduct: 'other',
    late_delivery: 'delay',
    cargo_damage: 'damage',
    cargo_missing: 'loss',
    wrong_delivery: 'partial_loss',
    booking_issue: 'other',
    other: 'other'
  };
  return map[category] || 'other';
}

function canAccessBooking(booking, userId) {
  return booking.user?._id?.toString() === userId ||
    booking.user?.toString?.() === userId ||
    booking.shipper?._id?.toString() === userId ||
    booking.shipper?.toString?.() === userId ||
    booking.transporter?._id?.toString() === userId ||
    booking.transporter?.toString?.() === userId;
}

function getBookingCounterparty(booking, userId) {
  const claimantIsTransporter = booking.transporter?._id?.toString() === userId ||
    booking.transporter?.toString?.() === userId;
  const counterparty = claimantIsTransporter ? booking.shipper || booking.user : booking.transporter;

  if (!counterparty) return undefined;
  return {
    user: counterparty._id || counterparty,
    name: counterparty.fullName || counterparty.name,
    email: counterparty.email,
    phone: counterparty.phone,
    role: claimantIsTransporter ? 'shipper' : 'transporter'
  };
}

async function holdEscrowForClaim(booking, claim, userId, reason, description) {
  try {
    const escrow = await escrowService.raiseDispute(booking._id, userId, reason, description);
    claim.metadata = {
      ...(claim.metadata || {}),
      escrowHold: {
        status: 'held',
        escrow: escrow._id,
        escrowReference: escrow.escrowReference,
        heldAt: new Date()
      }
    };
  } catch (error) {
    claim.metadata = {
      ...(claim.metadata || {}),
      escrowHold: {
        status: 'not_held',
        reason: error.message,
        checkedAt: new Date()
      }
    };
  }
}

exports.createDispute = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      bookingId,
      category,
      issueType,
      description,
      desiredOutcome,
      claimedValue
    } = req.body;

    const disputeCategory = category || issueType;

    if (!bookingId || !disputeCategory || !description) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, category, and description are required'
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('shipper')
      .populate('transporter');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!canAccessBooking(booking, userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to file a dispute for this booking'
      });
    }

    const existingDispute = await InsuranceClaim.findOne({
      booking: bookingId,
      'metadata.caseType': 'platform_dispute',
      status: { $nin: ['closed', 'withdrawn', 'rejected'] }
    });
    if (existingDispute) {
      return res.status(409).json({
        success: false,
        message: 'An active dispute already exists for this booking',
        data: {
          claimId: existingDispute._id,
          claimReference: existingDispute.claimReference,
          status: existingDispute.status
        }
      });
    }

    const isTransporter = booking.transporter?._id?.toString() === userId;
    const finalizedFiles = await finalizeUploadedFiles(req.files || [], 'claims');
    const uploadedDocuments = finalizedFiles.map(file => ({
      type: file.mimetype === 'application/pdf' ? 'other' : 'photo_damage',
      name: file.originalName,
      url: file.url,
      uploadedAt: new Date(),
      storageKey: file.key,
      storageProvider: file.provider
    }));

    const claim = new InsuranceClaim({
      booking: bookingId,
      policy: {
        providerCode: booking.insurance?.provider || 'PLATFORM',
        providerName: booking.insurance?.provider || 'Palmtrent Dispute Desk',
        coverageType: booking.insurance?.required ? 'insured_dispute' : 'platform_dispute',
        premium: booking.insurance?.premium || 0
      },
      claimant: {
        user: userId,
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
        role: isTransporter ? 'transporter' : 'shipper'
      },
      respondent: getBookingCounterparty(booking, userId),
      incident: {
        type: mapDisputeCategoryToIncident(disputeCategory),
        description,
        dateOccurred: new Date(),
        locationDescription: booking.route?.pickup?.address || booking.route?.delivery?.address
      },
      cargo: {
        description: booking.cargoDetails?.description || booking.cargoDetails?.type,
        declaredValue: booking.cargoDetails?.value || 0,
        claimedValue: Number(claimedValue || booking.cargoDetails?.value || 0)
      },
      documents: uploadedDocuments,
      status: 'submitted',
      timeline: {
        submittedAt: new Date()
      },
      metadata: {
        caseType: 'platform_dispute',
        category: disputeCategory,
        desiredOutcome
      }
    });

    claim.setSLADeadlines();
    await holdEscrowForClaim(booking, claim, userId, disputeCategory, description);
    await claim.save();

    assertBookingTransition(booking.status, 'disputed');
    booking.status = 'disputed';
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'dispute.created',
      entityType: 'InsuranceClaim',
      entityId: claim._id,
      entityRef: claim.claimReference,
      after: { status: claim.status, booking: booking._id, bookingStatus: booking.status, category: disputeCategory },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Dispute submitted successfully',
      data: {
        claimReference: claim.claimReference,
        status: claim.status,
        documents: uploadedDocuments.length
      }
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit dispute'
    });
  }
};

// Create a new insurance claim
exports.createClaim = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const {
      incidentType,
      incidentDescription,
      incidentDate,
      locationDescription,
      itemsAffected,
      claimedValue,
      policeReportNumber
    } = req.body;

    // Get booking with insurance details
    const booking = await Booking.findById(bookingId)
      .populate('user')
      .populate('transporter');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking has insurance
    if (!booking.insurance?.required && !booking.insurance?.selected) {
      return res.status(400).json({
        success: false,
        message: 'This booking does not have insurance coverage'
      });
    }

    // Determine claimant role
    const isShipper = booking.user._id.toString() === userId;
    const isTransporter = booking.transporter?._id?.toString() === userId;

    if (!isShipper && !isTransporter) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to file a claim for this booking'
      });
    }

    // Check if claim already exists
    const existingClaim = await InsuranceClaim.findOne({
      booking: bookingId,
      'claimant.user': userId
    });

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: 'A claim has already been filed for this booking',
        data: { claimReference: existingClaim.claimReference }
      });
    }

    // Create claim
    const claim = new InsuranceClaim({
      booking: bookingId,
      policy: {
        providerCode: booking.insurance.provider || 'ZIMNAT',
        providerName: booking.insurance.providerName || 'Zimnat Lion Insurance',
        coverageType: booking.insurance.coverageType || 'standard',
        coveragePercentage: booking.insurance.coveragePercentage || 85,
        premium: booking.insurance.premium,
        excess: booking.insurance.excess || 0
      },
      claimant: {
        user: userId,
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
        role: isShipper ? 'shipper' : 'transporter'
      },
      respondent: getBookingCounterparty(booking, userId),
      incident: {
        type: incidentType,
        description: incidentDescription,
        dateOccurred: new Date(incidentDate),
        locationDescription,
        reportedToPolice: !!policeReportNumber,
        policeReportNumber
      },
      cargo: {
        description: booking.cargoDetails?.description,
        declaredValue: booking.cargoDetails?.value,
        claimedValue,
        itemsAffected: itemsAffected || []
      },
      status: 'draft'
    });

    // Check if reported within 24 hours
    claim.checkReportingTimeline();

    // Set SLA deadlines
    claim.setSLADeadlines();

    await claim.save();

    res.status(201).json({
      success: true,
      data: {
        claimReference: claim.claimReference,
        status: claim.status,
        message: 'Claim created. Please upload supporting documents to submit.'
      }
    });

  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create claim'
    });
  }
};

// Upload document to claim
exports.uploadDocument = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { documentType, documentName, documentUrl } = req.body;
    const userId = req.user.id;

    const claim = await InsuranceClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    const isClaimant = claim.claimant.user.toString() === userId;
    const isRespondent = claim.respondent?.user?.toString() === userId;
    if (!isClaimant && !isRespondent) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload documents to this claim'
      });
    }

    claim.documents.push({
      type: documentType,
      name: documentName,
      url: documentUrl,
      uploadedAt: new Date()
    });

    await claim.save();

    res.json({
      success: true,
      data: {
        documents: claim.documents
      },
      message: 'Document uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document'
    });
  }
};

// Submit claim for review
exports.submitClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user.id;

    const claim = await InsuranceClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (claim.claimant.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Claim has already been submitted'
      });
    }

    // Validate required documents
    const hasPhoto = claim.documents.some(d => d.type.startsWith('photo'));
    if (!hasPhoto) {
      return res.status(400).json({
        success: false,
        message: 'At least one photo is required to submit the claim'
      });
    }

    claim.status = 'submitted';
    claim.timeline.submittedAt = new Date();

    const booking = await Booking.findById(claim.booking);
    if (booking) {
      await holdEscrowForClaim(
        booking,
        claim,
        userId,
        claim.incident?.type || 'insurance_claim',
        claim.incident?.description || 'Insurance claim submitted'
      );
    }

    await claim.save();

    res.json({
      success: true,
      data: {
        claimReference: claim.claimReference,
        status: claim.status,
        sla: claim.sla
      },
      message: 'Claim submitted successfully. You will be notified of updates.'
    });

  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit claim'
    });
  }
};

// Get claim details
exports.getClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user.id;

    const claim = await InsuranceClaim.findById(claimId)
      .populate('booking', 'bookingReference route cargoDetails user shipper transporter')
      .populate('claimant.user', 'name email phone');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    // Check access
    const isClaimant = claim.claimant.user._id.toString() === userId;
    const isAdmin = req.user.userType === 'admin';
    const isBookingParty = canAccessBooking(claim.booking, userId);

    if (!isClaimant && !isAdmin && !isBookingParty) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this claim'
      });
    }

    res.json({
      success: true,
      data: claim
    });

  } catch (error) {
    console.error('Error getting claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get claim details'
    });
  }
};

// Get my claims
exports.getMyClaims = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      $or: [
        { 'claimant.user': userId },
        { 'respondent.user': userId }
      ]
    };
    if (status) query.status = status;

    const claims = await InsuranceClaim.find(query)
      .populate('booking', 'bookingReference')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await InsuranceClaim.countDocuments(query);

    res.json({
      success: true,
      data: {
        claims,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get claims'
    });
  }
};

// Add communication to claim
exports.addCommunication = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { message, attachments } = req.body;
    const userId = req.user.id;

    const claim = await InsuranceClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    const isClaimant = claim.claimant.user.toString() === userId;
    const isRespondent = claim.respondent?.user?.toString() === userId;
    const isAdmin = req.user.userType === 'admin';

    if (!isClaimant && !isRespondent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    claim.communication.push({
      from: isAdmin ? 'platform' : isRespondent ? 'respondent' : 'claimant',
      message,
      attachments: attachments || [],
      sentAt: new Date()
    });

    await claim.save();

    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error adding communication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Withdraw claim
exports.withdrawClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const userId = req.user.id;

    const claim = await InsuranceClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    if (claim.claimant.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (['approved', 'paid', 'closed'].includes(claim.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw claim in current status'
      });
    }

    claim.status = 'withdrawn';
    await claim.save();

    res.json({
      success: true,
      message: 'Claim withdrawn successfully'
    });

  } catch (error) {
    console.error('Error withdrawing claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw claim'
    });
  }
};

// Admin: Update claim status
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, notes, assessment, settlement, rejection, escrowResolution } = req.body;

    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const claim = await InsuranceClaim.findById(claimId);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    const before = { status: claim.status, settlement: claim.settlement };

    // Update status
    claim.status = status;

    // Update timeline
    if (status === 'under_review') {
      claim.timeline.reviewStartedAt = new Date();
      claim.timeline.acknowledgedAt = new Date();
      claim.sla.acknowledgementMet = new Date() <= claim.sla.acknowledgementDue;
    }

    if (status === 'additional_info_required') {
      claim.timeline.additionalInfoRequestedAt = new Date();
    }

    if (assessment) {
      claim.assessment = {
        ...assessment,
        assessor: req.user.id,
        assessedAt: new Date()
      };
      claim.timeline.assessmentCompletedAt = new Date();
    }

    if (status === 'approved' || status === 'partially_approved') {
      claim.calculateSettlement();
      claim.timeline.decisionMadeAt = new Date();
      claim.sla.decisionMet = new Date() <= claim.sla.decisionDue;
    }

    if (settlement) {
      claim.settlement = {
        ...claim.settlement,
        ...settlement,
        paidBy: req.user.id
      };
      if (settlement.paidAt) {
        claim.timeline.paymentProcessedAt = new Date();
        claim.sla.paymentMet = new Date() <= claim.sla.paymentDue;
      }
    }

    if (status === 'rejected' && rejection) {
      claim.rejection = {
        ...rejection,
        rejectedAt: new Date(),
        rejectedBy: req.user.id,
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
      claim.timeline.decisionMadeAt = new Date();
    }

    if (status === 'closed') {
      claim.timeline.closedAt = new Date();
    }

    if (escrowResolution) {
      const { resolution, resolvedInFavorOf, splitPercentage } = escrowResolution;
      if (!resolution || !['shipper', 'transporter', 'split'].includes(resolvedInFavorOf)) {
        return res.status(400).json({
          success: false,
          message: 'Escrow resolution requires resolution and resolvedInFavorOf'
        });
      }

      const escrow = await escrowService.getEscrowByBooking(claim.booking);
      if (!escrow || escrow.status !== 'disputed') {
        return res.status(400).json({
          success: false,
          message: 'No disputed escrow is available for this claim'
        });
      }

      const resolvedEscrow = await escrowService.resolveDispute(
        escrow._id,
        resolution,
        resolvedInFavorOf,
        splitPercentage
      );
      claim.metadata = {
        ...(claim.metadata || {}),
        escrowResolution: {
          status: resolvedEscrow.status,
          escrow: resolvedEscrow._id,
          escrowReference: resolvedEscrow.escrowReference,
          resolvedInFavorOf,
          resolution,
          resolvedAt: new Date()
        }
      };
    }

    // Add status change note
    if (notes) {
      const lastHistory = claim.statusHistory[claim.statusHistory.length - 1];
      if (lastHistory) {
        lastHistory.notes = notes;
        lastHistory.changedBy = req.user.id;
      }
    }

    await claim.save();

    await recordAudit({
      actor: req.user,
      action: 'claim.status_updated',
      entityType: 'InsuranceClaim',
      entityId: claim._id,
      entityRef: claim.claimReference,
      before,
      after: { status: claim.status, settlement: claim.settlement },
      metadata: { notes },
      req
    });

    res.json({
      success: true,
      data: claim,
      message: `Claim status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating claim status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update claim status'
    });
  }
};

// Admin: Get all claims
exports.adminGetClaims = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const claims = await InsuranceClaim.find(query)
      .populate('booking', 'bookingReference')
      .populate('claimant.user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await InsuranceClaim.countDocuments(query);
    const stats = await InsuranceClaim.getStatistics();

    res.json({
      success: true,
      data: {
        claims,
        statistics: stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get claims'
    });
  }
};

module.exports = exports;
