const CrossBorderDestination = require('../models/CrossBorderDestination');
const Booking = require('../models/Booking');

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

    // Platform fee (12%)
    const platformFeePercentage = 0.12;
    const platformFee = Math.round(subtotal * platformFeePercentage);

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
    const platformFee = Math.round(subtotal * 0.12);
    const total = subtotal + platformFee;

    // Create booking
    const booking = await Booking.create({
      shipper: req.user.id,
      pickup: {
        address: pickupLocation.address,
        city: pickupLocation.city,
        coordinates: pickupLocation.coordinates
      },
      delivery: {
        address: deliveryLocation.address,
        city: deliveryLocation.city,
        country: destination.countryName,
        countryCode: destination.countryCode,
        coordinates: deliveryLocation.coordinates
      },
      cargo: cargoDetails,
      vehicleType,
      scheduledPickupDate: scheduledDate,
      notes,
      isCrossBorder: true,
      crossBorderDetails: {
        destinationCountry: destination.countryCode,
        destinationCountryName: destination.countryName,
        borderPost: borderPost || destination.borderPosts[0]?.name,
        requiredDocuments: documents,
        pricing: priceBreakdown,
        tradeAgreement: destination.tradeAgreement
      },
      pricing: {
        basePrice,
        additionalCharges: [
          { name: 'Cross-border surcharge', amount: pricing.crossBorderSurcharge },
          { name: 'Yellow Card insurance', amount: pricing.yellowCardInsurance },
          { name: 'Documentation handling', amount: pricing.documentationHandling }
        ],
        platformFee,
        total
      },
      status: 'pending'
    });

    // Update destination popularity
    destination.popularityScore += 1;
    await destination.save();

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
      isCrossBorder: true
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
