const VehicleMake = require('../models/VehicleMake');
const VehicleModel = require('../models/VehicleModel');
const VehicleType = require('../models/VehicleType');
const CargoType = require('../models/CargoType');
const TrailerType = require('../models/TrailerType');
const InsuranceOption = require('../models/InsuranceOption');
const InsuranceProvider = require('../models/InsuranceProvider');

// @desc    Get all vehicle makes
// @route   GET /api/v1/reference/vehicle-makes
// @access  Public
exports.getVehicleMakes = async (req, res) => {
  try {
    const { popular } = req.query;

    let query = {};
    if (popular === 'true') {
      query.isPopular = true;
    }

    const makes = await VehicleMake.find(query)
      .select('name country isPopular logo')
      .sort({ isPopular: -1, name: 1 });

    res.status(200).json({
      success: true,
      count: makes.length,
      data: makes
    });
  } catch (error) {
    console.error('Error fetching vehicle makes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle makes'
    });
  }
};

// @desc    Get models for a specific make
// @route   GET /api/v1/reference/vehicle-makes/:makeId/models
// @access  Public
exports.getVehicleModels = async (req, res) => {
  try {
    const { makeId } = req.params;

    const models = await VehicleModel.find({ make: makeId })
      .select('name yearRange variants specifications compatibleVehicleTypes')
      .populate('compatibleVehicleTypes', 'name category')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: models.length,
      data: models
    });
  } catch (error) {
    console.error('Error fetching vehicle models:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle models'
    });
  }
};

// @desc    Get all vehicle types
// @route   GET /api/v1/reference/vehicle-types
// @access  Public
exports.getVehicleTypes = async (req, res) => {
  try {
    const { category, canAttachTrailer, hasTrailer } = req.query;

    let query = { isActive: true };

    if (category) {
      query.category = category;
    }
    if (canAttachTrailer === 'true') {
      query['trailerConfiguration.canAttachTrailer'] = true;
    }
    if (hasTrailer === 'true') {
      query['trailerConfiguration.hasIntegratedTrailer'] = true;
    }

    const types = await VehicleType.find(query)
      .populate('trailerConfiguration.compatibleTrailerTypes', 'name category')
      .sort({ displayOrder: 1, category: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: types.length,
      data: types
    });
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle types'
    });
  }
};

// @desc    Get vehicle types by category (grouped)
// @route   GET /api/v1/reference/vehicle-types/grouped
// @access  Public
exports.getVehicleTypesGrouped = async (req, res) => {
  try {
    const types = await VehicleType.find({ isActive: true })
      .populate('trailerConfiguration.compatibleTrailerTypes', 'name category')
      .sort({ displayOrder: 1, name: 1 });

    // Group by category
    const grouped = types.reduce((acc, type) => {
      const category = type.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(type);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Error fetching grouped vehicle types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle types'
    });
  }
};

// @desc    Get recommended vehicle type based on cargo
// @route   GET /api/v1/reference/vehicle-types/recommend
// @access  Public
exports.recommendVehicleType = async (req, res) => {
  try {
    const { weight, cargoTypeId, requiresRefrigeration, requiresLivestock, isHazardous } = req.query;

    let query = { isActive: true };

    // Build suitable cargo categories filter
    let requiredCapabilities = [];
    if (requiresRefrigeration === 'true') requiredCapabilities.push('refrigerated');
    if (requiresLivestock === 'true') requiredCapabilities.push('livestock');
    if (isHazardous === 'true') requiredCapabilities.push('dangerous_goods');

    if (requiredCapabilities.length > 0) {
      query.specialCapabilities = { $in: requiredCapabilities };
    }

    // Filter by weight capacity if provided
    if (weight) {
      const weightNum = parseFloat(weight);
      query['capacity.weight.max'] = { $gte: weightNum };
    }

    // If cargo type provided, find vehicles suitable for that cargo
    if (cargoTypeId) {
      query.suitableForCargoTypes = cargoTypeId;
    }

    const recommendations = await VehicleType.find(query)
      .populate('trailerConfiguration.compatibleTrailerTypes', 'name category')
      .sort({ 'capacity.weight.max': 1, displayOrder: 1 })
      .limit(5);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting vehicle recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting vehicle recommendations'
    });
  }
};

// @desc    Get all cargo types
// @route   GET /api/v1/reference/cargo-types
// @access  Public
exports.getCargoTypes = async (req, res) => {
  try {
    const { category, insuranceCategory } = req.query;

    let query = {};
    if (category) {
      query.category = category;
    }
    if (insuranceCategory) {
      query.insuranceCategory = insuranceCategory;
    }

    const cargoTypes = await CargoType.find(query)
      .populate('recommendedVehicleTypes', 'name category capacity')
      .populate('recommendedTrailerTypes', 'name category')
      .sort({ category: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: cargoTypes.length,
      data: cargoTypes
    });
  } catch (error) {
    console.error('Error fetching cargo types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cargo types'
    });
  }
};

// @desc    Get cargo types grouped by category
// @route   GET /api/v1/reference/cargo-types/grouped
// @access  Public
exports.getCargoTypesGrouped = async (req, res) => {
  try {
    const cargoTypes = await CargoType.find({})
      .populate('recommendedVehicleTypes', 'name category')
      .sort({ name: 1 });

    // Group by category
    const grouped = cargoTypes.reduce((acc, cargo) => {
      const category = cargo.category;
      if (!acc[category]) {
        acc[category] = {
          label: getCategoryLabel(category),
          items: []
        };
      }
      acc[category].items.push(cargo);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Error fetching grouped cargo types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cargo types'
    });
  }
};

// Helper function to get category labels
function getCategoryLabel(category) {
  const labels = {
    'general': 'General Cargo',
    'bulk': 'Bulk Materials',
    'liquid': 'Liquids & Tanker',
    'refrigerated': 'Refrigerated/Cold Chain',
    'hazardous': 'Hazardous Materials',
    'live': 'Livestock & Live Animals'
  };
  return labels[category] || category;
}

// @desc    Get all trailer types
// @route   GET /api/v1/reference/trailer-types
// @access  Public
exports.getTrailerTypes = async (req, res) => {
  try {
    const { category } = req.query;

    let query = {};
    if (category) {
      query.category = category;
    }

    const trailerTypes = await TrailerType.find(query)
      .populate('suitableForCargoTypes', 'name category')
      .sort({ category: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: trailerTypes.length,
      data: trailerTypes
    });
  } catch (error) {
    console.error('Error fetching trailer types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trailer types'
    });
  }
};

// @desc    Get all insurance options
// @route   GET /api/v1/reference/insurance-options
// @access  Public
exports.getInsuranceOptions = async (req, res) => {
  try {
    const { category, cargoTypeId } = req.query;

    let query = { isActive: true };

    if (category) {
      query.category = category;
    }
    if (cargoTypeId) {
      query.applicableCargoTypes = cargoTypeId;
    }

    const options = await InsuranceOption.find(query)
      .populate('applicableCargoTypes', 'name category')
      .sort({ category: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: options.length,
      data: options
    });
  } catch (error) {
    console.error('Error fetching insurance options:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching insurance options'
    });
  }
};

// @desc    Get insurance options by category (for dangerous goods, livestock, agriculture)
// @route   GET /api/v1/reference/insurance-options/by-category
// @access  Public
exports.getInsuranceOptionsByCategory = async (req, res) => {
  try {
    const options = await InsuranceOption.find({ isActive: true })
      .sort({ category: 1, name: 1 });

    // Group by category with proper labels
    const grouped = {
      general: {
        label: 'General Cargo Insurance',
        description: 'Standard coverage for general freight',
        options: []
      },
      dangerous_goods: {
        label: 'Dangerous Goods Insurance',
        description: 'Specialized coverage for hazardous materials',
        options: []
      },
      livestock: {
        label: 'Livestock Insurance',
        description: 'Coverage for live animals during transport',
        options: []
      },
      agriculture: {
        label: 'Agricultural Insurance',
        description: 'Coverage for agricultural products and produce',
        options: []
      },
      hazardous: {
        label: 'Hazardous Materials Insurance',
        description: 'High-risk materials requiring special handling',
        options: []
      }
    };

    options.forEach(option => {
      if (grouped[option.category]) {
        grouped[option.category].options.push(option);
      }
    });

    res.status(200).json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Error fetching insurance options by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching insurance options'
    });
  }
};

// @desc    Get insurance quotes from providers
// @route   POST /api/v1/reference/insurance-quotes
// @access  Public
exports.getInsuranceQuotes = async (req, res) => {
  try {
    const { cargoValue, cargoType, coverageType = 'standard' } = req.body;

    if (!cargoValue || !cargoType) {
      return res.status(400).json({
        success: false,
        message: 'Cargo value and type are required'
      });
    }

    const quotes = await InsuranceProvider.getAllQuotes(cargoValue, cargoType, coverageType);

    res.status(200).json({
      success: true,
      count: quotes.length,
      data: quotes
    });
  } catch (error) {
    console.error('Error fetching insurance quotes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching insurance quotes'
    });
  }
};

// @desc    Get all reference data in a single call (for initial app load)
// @route   GET /api/v1/reference/all
// @access  Public
exports.getAllReferenceData = async (req, res) => {
  try {
    const [
      vehicleMakes,
      vehicleTypes,
      cargoTypes,
      trailerTypes,
      insuranceCategories
    ] = await Promise.all([
      VehicleMake.find({}).select('name country isPopular logo').sort({ isPopular: -1, name: 1 }),
      VehicleType.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }),
      CargoType.find({}).sort({ category: 1, name: 1 }),
      TrailerType.find({}).sort({ category: 1, name: 1 }),
      InsuranceOption.find({ isActive: true }).select('name category baseRate rateType').sort({ category: 1 })
    ]);

    res.status(200).json({
      success: true,
      data: {
        vehicleMakes,
        vehicleTypes,
        cargoTypes,
        trailerTypes,
        insuranceCategories
      }
    });
  } catch (error) {
    console.error('Error fetching all reference data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reference data'
    });
  }
};
