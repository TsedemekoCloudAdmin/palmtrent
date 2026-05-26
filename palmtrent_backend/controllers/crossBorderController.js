const CrossBorderDestination = require('../models/CrossBorderDestination');
const Booking = require('../models/Booking');
const { recordAudit } = require('../services/auditService');
const { assertCorporateCanBook, reserveCorporateCredit } = require('../services/flowControlService');
const monetizationService = require('../services/monetizationService');

function generateBookingReference() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PT-XB-${timestamp}-${random}`;
}

// @desc    Get all available cross-border destinations
// @route   GET /api/v1/cross-border/destinations
// @access  Public
exports.getDestinations = async (req, res) => {
  try {
    const { popular, tradeAgreement } = req.query;

    let query = { isActive: true };

    if (popular === 'true') {
      query.isPopular = true;
    }

    if (tradeAgreement) {
      query.tradeAgreement = tradeAgreement;
    }

    const destinations = await CrossBorderDestination.find(query)
      .sort({ isPopular: -1, popularityScore: -1, countryName: 1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: destinations.length,
      data: destinations
    });
  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destinations',
      error: error.message
    });
  }
};

// @desc    Get single destination details
// @route   GET /api/v1/cross-border/destinations/:countryCode
// @access  Public
exports.getDestinationByCode = async (req, res) => {
  try {
    const destination = await CrossBorderDestination.findOne({
      countryCode: req.params.countryCode.toUpperCase(),
      isActive: true
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    res.status(200).json({
      success: true,
      data: destination
    });
  } catch (error) {
    console.error('Error fetching destination:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destination',
      error: error.message
    });
  }
};

// @desc    Get border post information
// @route   GET /api/v1/cross-border/border-posts/:countryCode
// @access  Public
exports.getBorderPosts = async (req, res) => {
  try {
    const destination = await CrossBorderDestination.findOne({
      countryCode: req.params.countryCode.toUpperCase(),
      isActive: true
    }).select('countryName countryCode borderPosts');

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        countryCode: destination.countryCode,
        countryName: destination.countryName,
        borderPosts: destination.borderPosts
      }
    });
  } catch (error) {
    console.error('Error fetching border posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch border posts',
      error: error.message
    });
  }
};

// @desc    Get required documents for a destination
// @route   GET /api/v1/cross-border/documents/:countryCode
// @access  Public
exports.getRequiredDocuments = async (req, res) => {
  try {
    const destination = await CrossBorderDestination.findOne({
      countryCode: req.params.countryCode.toUpperCase(),
      isActive: true
    }).select('countryName countryCode requiredDocuments driverRequirements');

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        countryCode: destination.countryCode,
        countryName: destination.countryName,
        requiredDocuments: destination.requiredDocuments,
        driverRequirements: destination.driverRequirements
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch required documents',
      error: error.message
    });
  }
};

// @desc    Calculate cross-border pricing
// @route   POST /api/v1/cross-border/calculate-price
// @access  Public
exports.calculatePrice = async (req, res) => {
  try {
    const {
      countryCode,
      basePrice,
      cargoWeight,
      cargoType,
      insuranceRequired
    } = req.body;

    const destination = await CrossBorderDestination.findOne({
      countryCode: countryCode.toUpperCase(),
      isActive: true
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const pricing = destination.pricing;
    const base = basePrice || 800; // Default base price

    // Calculate pricing breakdown
    const priceBreakdown = {
      baseTransport: base,
      crossBorderSurcharge: pricing.crossBorderSurcharge,
      yellowCardInsurance: insuranceRequired !== false ? pricing.yellowCardInsurance : 0,
      documentationHandling: pricing.documentationHandling,
      customsClearanceFee: pricing.customsClearanceFee,
      transitPermitFee: pricing.transitPermitFee
    };

    // Calculate subtotal
    const subtotal = Object.values(priceBreakdown).reduce((sum, val) => sum + val, 0);

    const feePreview = await monetizationService.calculateShipmentFees(subtotal, subtotal, {
      audience: req.user?.corporateAccount ? 'corporate' : 'all',
      paymentMethod: req.query.paymentMethod || 'openapi_africa'
    });
    const platformFeePercentage = feePreview.platformFeeRate;
    const platformFee = Math.round(feePreview.platformFee);

    // Total
    const total = subtotal + platformFee;

    res.status(200).json({
      success: true,
      data: {
        destination: {
          countryCode: destination.countryCode,
          countryName: destination.countryName
        },
        breakdown: {
          ...priceBreakdown,
          platformFee,
          platformFeePercentage: platformFeePercentage * 100
        },
        subtotal,
        total,
        currency: 'USD'
      }
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate price',
      error: error.message
    });
  }
};

// @desc    Update border post status (real-time updates)
// @route   PATCH /api/v1/cross-border/border-status/:countryCode/:borderPostName
// @access  Private (Admin)
exports.updateBorderStatus = async (req, res) => {
  try {
    const { countryCode, borderPostName } = req.params;
    const { currentStatus, averageWaitTime } = req.body;

    const destination = await CrossBorderDestination.findOne({
      countryCode: countryCode.toUpperCase()
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const borderPost = destination.borderPosts.find(
      bp => bp.name.toLowerCase() === borderPostName.toLowerCase()
    );

    if (!borderPost) {
      return res.status(404).json({
        success: false,
        message: 'Border post not found'
      });
    }

    if (currentStatus) {
      borderPost.currentStatus = currentStatus;
    }

    if (averageWaitTime) {
      borderPost.averageWaitTime = averageWaitTime;
    }

    await destination.save();

    res.status(200).json({
      success: true,
      message: 'Border status updated',
      data: borderPost
    });
  } catch (error) {
    console.error('Error updating border status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update border status',
      error: error.message
    });
  }
};

// @desc    Create cross-border booking
// @route   POST /api/v1/cross-border/bookings
// @access  Private
exports.createCrossBorderBooking = async (req, res) => {
  try {
    const {
      destinationCountry,
      borderPost,
      pickupLocation,
      deliveryLocation,
      cargoDetails,
      documents,
      vehicleType,
      scheduledDate,
      notes
    } = req.body;

    // Validate destination
    const destination = await CrossBorderDestination.findOne({
      countryCode: destinationCountry.toUpperCase(),
      isActive: true
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Invalid destination country'
      });
    }

    // Calculate pricing
    const pricing = destination.pricing;
    const basePrice = 800; // This would typically come from route calculation

    const priceBreakdown = {
      baseTransport: basePrice,
      crossBorderSurcharge: pricing.crossBorderSurcharge,
      yellowCardInsurance: pricing.yellowCardInsurance,
      documentationHandling: pricing.documentationHandling,
      customsClearanceFee: pricing.customsClearanceFee,
      transitPermitFee: pricing.transitPermitFee
    };

    const subtotal = Object.values(priceBreakdown).reduce((sum, val) => sum + val, 0);
    const feePreview = await monetizationService.calculateShipmentFees(subtotal, subtotal, {
      audience: req.user?.corporateAccount ? 'corporate' : 'all',
      paymentMethod: req.body.paymentMethod || 'openapi_africa'
    });
    const platformFee = Math.round(feePreview.platformFee);
    const total = subtotal + platformFee;

    const bookingData = {
      bookingReference: generateBookingReference(),
      user: req.user.id,
      shipper: req.user.id,
      corporateAccount: req.user.corporateAccount,
      status: 'pending_payment',
      paymentStatus: 'pending',
      bookingType: 'single',
      route: {
        pickup: {
          address: pickupLocation?.address || pickupLocation || '',
          city: pickupLocation?.city,
          date: scheduledDate ? new Date(scheduledDate) : new Date(),
          coordinates: {
            type: 'Point',
            coordinates: pickupLocation?.coordinates?.coordinates || pickupLocation?.coordinates || [0, 0]
          }
        },
        delivery: {
          address: deliveryLocation?.address || deliveryLocation || '',
          city: deliveryLocation?.city,
          coordinates: {
            type: 'Point',
            coordinates: deliveryLocation?.coordinates?.coordinates || deliveryLocation?.coordinates || [0, 0]
          }
        },
        distance: destination.distanceFromOrigin?.value || 0,
        estimatedDuration: `${destination.transitInfo?.averageTransitDays || 2} days`
      },
      cargoDetails: {
        type: cargoDetails?.type || cargoDetails?.description || 'cross_border_cargo',
        weight: Number(cargoDetails?.weight || 0),
        value: Number(cargoDetails?.value || cargoDetails?.declaredValue || 0),
        description: cargoDetails?.description || cargoDetails?.type || 'Cross-border cargo',
        specialInstructions: notes || cargoDetails?.specialInstructions || ''
      },
      vehicleType,
      pickupDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      origin: pickupLocation?.city || pickupLocation?.address || '',
      destination: deliveryLocation?.city || destination.countryName,
      totalAmount: total,
      crossBorder: {
        enabled: true,
        destinationCountry: destination.countryCode,
        destinationCountryName: destination.countryName,
        borderPost: borderPost || destination.borderPosts[0]?.name,
        requiredDocuments: {
          commercialInvoice: true,
          packingList: true,
          certificateOrigin: true,
          cargoManifest: true
        },
        documents: Array.isArray(documents) ? documents.map(document => ({
          type: document.type || document.name || 'cross_border_document',
          name: document.name || document.type || 'Cross-border document',
          url: document.url,
          status: document.url ? 'uploaded' : 'pending',
          uploadedAt: document.url ? new Date() : undefined
        })) : [],
        pricing: priceBreakdown,
        tradeAgreement: destination.tradeAgreement
      },
      insurance: {
        required: true,
        premium: pricing.yellowCardInsurance,
        coverage: Number(cargoDetails?.value || cargoDetails?.declaredValue || 0)
      },
      pricing: {
        breakdown: {
          baseTransportFee: basePrice,
          crossBorderFees: {
            baseSurcharge: pricing.crossBorderSurcharge,
            documentationFee: pricing.documentationHandling,
            insurancePremium: pricing.yellowCardInsurance,
            total: pricing.crossBorderSurcharge + pricing.documentationHandling + pricing.yellowCardInsurance
          },
          platformFee,
          insurance: pricing.yellowCardInsurance
        },
        totals: {
          subtotal,
          total,
          platformTotal: platformFee,
          transporterTotal: subtotal,
          insuranceTotal: pricing.yellowCardInsurance
        },
        currency: 'USD'
      },
      payment: {
        method: req.body.paymentMethod || 'digital',
        status: 'pending'
      }
    };

    const corporateAccount = await assertCorporateCanBook(req.user, total);
    if (corporateAccount && !bookingData.corporateAccount) {
      bookingData.corporateAccount = corporateAccount._id;
    }

    const booking = await Booking.create(bookingData);

    if (corporateAccount && booking.payment?.method === 'corporate') {
      await reserveCorporateCredit(corporateAccount._id, total);
    }

    // Update destination popularity
    destination.popularityScore += 1;
    await destination.save();

    await recordAudit({
      actor: req.user,
      action: 'cross_border.booking_created',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status, countryCode: destination.countryCode, totalAmount: total },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Cross-border booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating cross-border booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
};

// @desc    Get cross-border bookings for current user
// @route   GET /api/v1/cross-border/my-bookings
// @access  Private
exports.getMyCrossBorderBookings = async (req, res) => {
  try {
    const { status } = req.query;

    let query = {
      shipper: req.user.id,
      'crossBorder.enabled': true
    };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('transporter', 'name phone')
      .populate('vehicle')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

exports.uploadBookingDocument = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { type, name, url } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking || !booking.crossBorder?.enabled) {
      return res.status(404).json({ success: false, message: 'Cross-border booking not found' });
    }

    const canAccess = booking.shipper.toString() === req.user.id ||
      booking.user.toString() === req.user.id ||
      req.user.userType === 'admin';
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    booking.crossBorder.documents.push({
      type,
      name: name || type,
      url,
      status: url ? 'uploaded' : 'pending',
      uploadedAt: new Date()
    });
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'cross_border.document_uploaded',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { type, status: url ? 'uploaded' : 'pending' },
      req
    });

    res.status(201).json({ success: true, message: 'Document added', data: booking.crossBorder.documents });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add document', error: error.message });
  }
};

exports.getBookingCompliance = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking || !booking.crossBorder?.enabled) {
      return res.status(404).json({ success: false, message: 'Cross-border booking not found' });
    }

    const canAccess = booking.shipper?.toString() === req.user.id ||
      booking.user?.toString() === req.user.id ||
      booking.transporter?.toString() === req.user.id ||
      req.user.userType === 'admin';
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const required = Object.entries(booking.crossBorder.requiredDocuments || {})
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    const documents = booking.crossBorder.documents || [];
    const uploadedTypes = new Set(documents.filter(doc => ['uploaded', 'verified'].includes(doc.status)).map(doc => doc.type));
    const missing = required.filter(type => !uploadedTypes.has(type));
    const rejected = documents.filter(doc => doc.status === 'rejected');
    const verifiedCount = documents.filter(doc => doc.status === 'verified').length;

    res.json({
      success: true,
      data: {
        ready: missing.length === 0 && rejected.length === 0,
        required,
        missing,
        rejected,
        verifiedCount,
        documents
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check compliance', error: error.message });
  }
};

exports.reviewBookingDocument = async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { bookingId, documentId } = req.params;
    const { status, notes } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const document = booking.crossBorder.documents.id(documentId);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    document.status = status;
    document.notes = notes;
    if (status === 'verified') document.verifiedAt = new Date();
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'cross_border.document_reviewed',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { documentId, status, notes },
      req
    });

    res.json({ success: true, message: 'Document reviewed', data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to review document', error: error.message });
  }
};

// @desc    Seed default SADC destinations
// @route   POST /api/v1/cross-border/seed
// @access  Private (Admin)
exports.seedDestinations = async (req, res) => {
  try {
    const defaultDestinations = [
      {
        countryCode: 'ZA',
        countryName: 'South Africa',
        flag: '🇿🇦',
        borderPosts: [{
          name: 'Beitbridge',
          operatingHours: '24/7',
          is24Hours: true,
          bestCrossingTimes: '6AM - 10AM',
          averageWaitTime: { min: 2, max: 4 },
          currentStatus: 'open',
          facilities: ['customs', 'immigration', 'health_check', 'weighbridge', 'rest_area', 'fuel_station', 'parking']
        }],
        distanceFromOrigin: { value: 1000, unit: 'km' },
        requiredDocuments: [
          { name: 'Commercial Invoice', description: 'Invoice for goods being transported', required: true },
          { name: 'Packing List', description: 'Detailed list of cargo contents', required: true },
          { name: 'Certificate of Origin', description: 'Document proving origin of goods', required: true },
          { name: 'Cargo Manifest', description: 'Summary of cargo being transported', required: true }
        ],
        driverRequirements: [
          { requirement: 'Valid passport (6+ months validity)', mandatory: true },
          { requirement: 'Cross-border experience (10+ trips)', mandatory: true },
          { requirement: 'Yellow Card insurance (SADC)', mandatory: true },
          { requirement: 'Valid vehicle documentation', mandatory: true }
        ],
        pricing: {
          crossBorderSurcharge: 50,
          yellowCardInsurance: 50,
          documentationHandling: 30,
          customsClearanceFee: 0,
          transitPermitFee: 0
        },
        transitInfo: {
          averageTransitDays: 2,
          customsProcedure: 'Standard SADC customs clearance'
        },
        tradeAgreement: 'SADC',
        currency: { code: 'ZAR', name: 'South African Rand' },
        isPopular: true,
        popularityScore: 100,
        isActive: true
      },
      {
        countryCode: 'BW',
        countryName: 'Botswana',
        flag: '🇧🇼',
        borderPosts: [{
          name: 'Plumtree',
          operatingHours: '6AM - 10PM',
          is24Hours: false,
          bestCrossingTimes: '8AM - 12PM',
          averageWaitTime: { min: 1, max: 3 },
          currentStatus: 'open',
          facilities: ['customs', 'immigration', 'weighbridge', 'parking']
        }],
        distanceFromOrigin: { value: 500, unit: 'km' },
        requiredDocuments: [
          { name: 'Commercial Invoice', description: 'Invoice for goods being transported', required: true },
          { name: 'Packing List', description: 'Detailed list of cargo contents', required: true },
          { name: 'Certificate of Origin', description: 'Document proving origin of goods', required: true },
          { name: 'Cargo Manifest', description: 'Summary of cargo being transported', required: true }
        ],
        driverRequirements: [
          { requirement: 'Valid passport (6+ months validity)', mandatory: true },
          { requirement: 'Cross-border experience (10+ trips)', mandatory: true },
          { requirement: 'Yellow Card insurance (SADC)', mandatory: true },
          { requirement: 'Valid vehicle documentation', mandatory: true }
        ],
        pricing: {
          crossBorderSurcharge: 40,
          yellowCardInsurance: 50,
          documentationHandling: 25,
          customsClearanceFee: 0,
          transitPermitFee: 0
        },
        transitInfo: {
          averageTransitDays: 1,
          customsProcedure: 'Standard SADC customs clearance'
        },
        tradeAgreement: 'SADC',
        currency: { code: 'BWP', name: 'Botswana Pula' },
        isPopular: true,
        popularityScore: 80,
        isActive: true
      },
      {
        countryCode: 'ZM',
        countryName: 'Zambia',
        flag: '🇿🇲',
        borderPosts: [{
          name: 'Chirundu',
          operatingHours: '24/7',
          is24Hours: true,
          bestCrossingTimes: '6AM - 10AM',
          averageWaitTime: { min: 1, max: 3 },
          currentStatus: 'open',
          facilities: ['customs', 'immigration', 'health_check', 'weighbridge', 'rest_area', 'parking']
        }],
        distanceFromOrigin: { value: 400, unit: 'km' },
        requiredDocuments: [
          { name: 'Commercial Invoice', description: 'Invoice for goods being transported', required: true },
          { name: 'Packing List', description: 'Detailed list of cargo contents', required: true },
          { name: 'Certificate of Origin', description: 'Document proving origin of goods', required: true },
          { name: 'Cargo Manifest', description: 'Summary of cargo being transported', required: true }
        ],
        driverRequirements: [
          { requirement: 'Valid passport (6+ months validity)', mandatory: true },
          { requirement: 'Cross-border experience (10+ trips)', mandatory: true },
          { requirement: 'Yellow Card insurance (SADC)', mandatory: true },
          { requirement: 'Valid vehicle documentation', mandatory: true }
        ],
        pricing: {
          crossBorderSurcharge: 45,
          yellowCardInsurance: 50,
          documentationHandling: 30,
          customsClearanceFee: 0,
          transitPermitFee: 0
        },
        transitInfo: {
          averageTransitDays: 1,
          customsProcedure: 'COMESA-SADC simplified clearance'
        },
        tradeAgreement: 'SADC',
        currency: { code: 'ZMW', name: 'Zambian Kwacha' },
        isPopular: true,
        popularityScore: 75,
        isActive: true
      },
      {
        countryCode: 'MZ',
        countryName: 'Mozambique',
        flag: '🇲🇿',
        borderPosts: [{
          name: 'Forbes/Machipanda',
          operatingHours: '6AM - 6PM',
          is24Hours: false,
          bestCrossingTimes: '8AM - 11AM',
          averageWaitTime: { min: 2, max: 4 },
          currentStatus: 'open',
          facilities: ['customs', 'immigration', 'parking']
        }],
        distanceFromOrigin: { value: 300, unit: 'km' },
        requiredDocuments: [
          { name: 'Commercial Invoice', description: 'Invoice for goods being transported', required: true },
          { name: 'Packing List', description: 'Detailed list of cargo contents', required: true },
          { name: 'Certificate of Origin', description: 'Document proving origin of goods', required: true },
          { name: 'Cargo Manifest', description: 'Summary of cargo being transported', required: true }
        ],
        driverRequirements: [
          { requirement: 'Valid passport (6+ months validity)', mandatory: true },
          { requirement: 'Cross-border experience (10+ trips)', mandatory: true },
          { requirement: 'Yellow Card insurance (SADC)', mandatory: true },
          { requirement: 'Valid vehicle documentation', mandatory: true }
        ],
        pricing: {
          crossBorderSurcharge: 55,
          yellowCardInsurance: 50,
          documentationHandling: 35,
          customsClearanceFee: 10,
          transitPermitFee: 0
        },
        transitInfo: {
          averageTransitDays: 1,
          customsProcedure: 'Standard SADC customs clearance'
        },
        tradeAgreement: 'SADC',
        currency: { code: 'MZN', name: 'Mozambican Metical' },
        isPopular: false,
        popularityScore: 40,
        isActive: true
      }
    ];

    // Clear existing and insert new
    await CrossBorderDestination.deleteMany({});
    const inserted = await CrossBorderDestination.insertMany(defaultDestinations);

    res.status(201).json({
      success: true,
      message: 'Destinations seeded successfully',
      count: inserted.length,
      data: inserted
    });
  } catch (error) {
    console.error('Error seeding destinations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed destinations',
      error: error.message
    });
  }
};
