/**
 * Seed Reference Data Script
 *
 * Seeds the database with:
 * - Vehicle Makes (truck/commercial vehicle manufacturers)
 * - Vehicle Types (bakkies, trucks, tractors)
 * - Cargo Types (general, bulk, hazardous, livestock, etc.)
 * - Trailer Types (flatbed, tanker, refrigerated, etc.)
 * - Insurance Options (by category)
 *
 * Run: node scripts/seedReferenceData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const VehicleMake = require('../models/VehicleMake');
const VehicleModel = require('../models/VehicleModel');
const VehicleType = require('../models/VehicleType');
const CargoType = require('../models/CargoType');
const TrailerType = require('../models/TrailerType');
const InsuranceOption = require('../models/InsuranceOption');
const InsuranceProvider = require('../models/InsuranceProvider');

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/palmtrent');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

// ========================================
// VEHICLE TYPES SEED DATA
// ========================================
const vehicleTypesData = [
  // Bakkies
  {
    name: 'Single Cab Bakkie',
    category: 'bakkie',
    subcategory: 'single_cab',
    description: 'Light duty single cab bakkie for small loads',
    capacity: {
      weight: { min: 0.5, max: 1, unit: 'tonnes' },
      volume: { min: 1, max: 2, unit: 'cubic_meters' }
    },
    dimensions: { length: 2.2, width: 1.5, height: 0.5 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general'],
    specialCapabilities: [],
    requirements: { licenseClass: 'code_8' },
    pricing: { baseRatePerKm: 3.5, minimumCharge: 150 },
    displayOrder: 1,
    isActive: true
  },
  {
    name: 'Double Cab Bakkie',
    category: 'bakkie',
    subcategory: 'double_cab',
    description: 'Light duty double cab bakkie with passenger capacity',
    capacity: {
      weight: { min: 0.5, max: 1.2, unit: 'tonnes' },
      volume: { min: 1.5, max: 2.5, unit: 'cubic_meters' }
    },
    dimensions: { length: 1.8, width: 1.5, height: 0.5 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general'],
    specialCapabilities: [],
    requirements: { licenseClass: 'code_8' },
    pricing: { baseRatePerKm: 4, minimumCharge: 180 },
    displayOrder: 2,
    isActive: true
  },
  {
    name: 'Panel Van',
    category: 'van',
    subcategory: 'panel_van',
    description: 'Enclosed panel van for secure deliveries',
    capacity: {
      weight: { min: 0.8, max: 1.5, unit: 'tonnes' },
      volume: { min: 4, max: 8, unit: 'cubic_meters' }
    },
    dimensions: { length: 2.5, width: 1.6, height: 1.6 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general'],
    specialCapabilities: [],
    requirements: { licenseClass: 'code_8' },
    pricing: { baseRatePerKm: 4.5, minimumCharge: 200 },
    displayOrder: 3,
    isActive: true
  },
  {
    name: 'Delivery Van',
    category: 'van',
    subcategory: 'delivery_van',
    description: 'Small delivery van for urban deliveries',
    capacity: {
      weight: { min: 0.5, max: 1, unit: 'tonnes' },
      volume: { min: 2, max: 5, unit: 'cubic_meters' }
    },
    dimensions: { length: 2, width: 1.5, height: 1.4 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general'],
    specialCapabilities: [],
    requirements: { licenseClass: 'code_8' },
    pricing: { baseRatePerKm: 3.5, minimumCharge: 120 },
    displayOrder: 4,
    isActive: true
  },
  // Trucks by tonnage
  {
    name: '3-Tonne Truck',
    category: 'truck',
    subcategory: '3ton',
    description: 'Medium duty truck for general cargo',
    capacity: {
      weight: { min: 1, max: 3, unit: 'tonnes' },
      volume: { min: 10, max: 18, unit: 'cubic_meters' }
    },
    dimensions: { length: 4.2, width: 2.2, height: 2.2 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['tail_lift'],
    requirements: { licenseClass: 'code_10' },
    pricing: { baseRatePerKm: 6, minimumCharge: 350 },
    displayOrder: 10,
    isActive: true
  },
  {
    name: '5-Tonne Truck',
    category: 'truck',
    subcategory: '5ton',
    description: 'Medium duty truck with higher capacity',
    capacity: {
      weight: { min: 3, max: 5, unit: 'tonnes' },
      volume: { min: 20, max: 30, unit: 'cubic_meters' }
    },
    dimensions: { length: 5, width: 2.4, height: 2.4 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['tail_lift'],
    requirements: { licenseClass: 'code_10' },
    pricing: { baseRatePerKm: 7.5, minimumCharge: 500 },
    displayOrder: 11,
    isActive: true
  },
  {
    name: '7-Tonne Truck',
    category: 'truck',
    subcategory: '7ton',
    description: 'Heavy duty rigid truck',
    capacity: {
      weight: { min: 5, max: 7, unit: 'tonnes' },
      volume: { min: 30, max: 40, unit: 'cubic_meters' }
    },
    dimensions: { length: 6, width: 2.4, height: 2.4 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['tail_lift', 'crane_equipped'],
    requirements: { licenseClass: 'code_10' },
    pricing: { baseRatePerKm: 9, minimumCharge: 650 },
    displayOrder: 12,
    isActive: true
  },
  {
    name: '10-Tonne Truck',
    category: 'truck',
    subcategory: '10ton',
    description: 'Heavy duty truck for large loads',
    capacity: {
      weight: { min: 7, max: 10, unit: 'tonnes' },
      volume: { min: 40, max: 50, unit: 'cubic_meters' }
    },
    dimensions: { length: 7, width: 2.4, height: 2.6 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['tail_lift', 'crane_equipped'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 11, minimumCharge: 800 },
    displayOrder: 13,
    isActive: true
  },
  {
    name: '15-Tonne Truck',
    category: 'truck',
    subcategory: '15ton',
    description: 'Heavy duty rigid truck with max capacity',
    capacity: {
      weight: { min: 10, max: 15, unit: 'tonnes' },
      volume: { min: 50, max: 65, unit: 'cubic_meters' }
    },
    dimensions: { length: 8, width: 2.5, height: 2.8 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['tail_lift', 'crane_equipped'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 13, minimumCharge: 1000 },
    displayOrder: 14,
    isActive: true
  },
  // Tractors (Horse)
  {
    name: 'Truck Tractor (Horse Only)',
    category: 'tractor',
    subcategory: 'horse_only',
    description: 'Truck tractor unit without trailer - requires separate trailer',
    capacity: {
      weight: { min: 0, max: 0, unit: 'tonnes' }
    },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: true,
      requiresTrailer: true
    },
    suitableCargoCategories: ['general', 'bulk', 'liquid', 'refrigerated', 'hazardous', 'live'],
    specialCapabilities: [],
    requirements: { licenseClass: 'ec' },
    pricing: { baseRatePerKm: 8, minimumCharge: 500 },
    displayOrder: 20,
    isActive: true
  },
  {
    name: 'Interlink (34-Tonne)',
    category: 'tractor',
    subcategory: 'with_trailer',
    description: 'Truck tractor with interlink trailer - 34 tonne capacity',
    capacity: {
      weight: { min: 20, max: 34, unit: 'tonnes' },
      volume: { min: 60, max: 90, unit: 'cubic_meters' }
    },
    dimensions: { length: 18, width: 2.5, height: 4.3 },
    trailerConfiguration: {
      hasIntegratedTrailer: true,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['flatbed', 'curtain_side'],
    requirements: { licenseClass: 'ec1' },
    pricing: { baseRatePerKm: 18, minimumCharge: 2500 },
    displayOrder: 21,
    isActive: true
  },
  // Specialized trucks
  {
    name: 'Refrigerated Truck (5-Tonne)',
    category: 'truck',
    subcategory: '5ton',
    description: 'Temperature controlled truck for cold chain',
    capacity: {
      weight: { min: 3, max: 5, unit: 'tonnes' },
      volume: { min: 18, max: 25, unit: 'cubic_meters' }
    },
    dimensions: { length: 5, width: 2.4, height: 2.4 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['refrigerated'],
    specialCapabilities: ['refrigerated'],
    requirements: { licenseClass: 'code_10' },
    pricing: { baseRatePerKm: 12, minimumCharge: 800 },
    displayOrder: 30,
    isActive: true
  },
  {
    name: 'Refrigerated Truck (10-Tonne)',
    category: 'truck',
    subcategory: '10ton',
    description: 'Large temperature controlled truck',
    capacity: {
      weight: { min: 7, max: 10, unit: 'tonnes' },
      volume: { min: 35, max: 45, unit: 'cubic_meters' }
    },
    dimensions: { length: 7, width: 2.4, height: 2.6 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['refrigerated'],
    specialCapabilities: ['refrigerated'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 16, minimumCharge: 1200 },
    displayOrder: 31,
    isActive: true
  },
  {
    name: 'Tipper Truck (10-Tonne)',
    category: 'truck',
    subcategory: '10ton',
    description: 'Tipper truck for bulk materials',
    capacity: {
      weight: { min: 7, max: 10, unit: 'tonnes' },
      volume: { min: 6, max: 8, unit: 'cubic_meters' }
    },
    dimensions: { length: 5, width: 2.4, height: 1.2 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['bulk'],
    specialCapabilities: ['tipper'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 14, minimumCharge: 900 },
    displayOrder: 35,
    isActive: true
  },
  {
    name: 'Livestock Truck',
    category: 'truck',
    subcategory: '10ton',
    description: 'Specialized truck for transporting live animals',
    capacity: {
      weight: { min: 5, max: 10, unit: 'tonnes' }
    },
    dimensions: { length: 7, width: 2.4, height: 2.8 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['live'],
    specialCapabilities: ['livestock'],
    requirements: { licenseClass: 'code_14', specialPermits: ['Livestock Transport Permit'] },
    pricing: { baseRatePerKm: 15, minimumCharge: 1100 },
    displayOrder: 40,
    isActive: true
  },
  {
    name: 'Tanker Truck',
    category: 'truck',
    subcategory: '15ton',
    description: 'Tanker truck for liquid transport',
    capacity: {
      weight: { min: 10, max: 15, unit: 'tonnes' },
      volume: { min: 10000, max: 20000, unit: 'liters' }
    },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['liquid'],
    specialCapabilities: ['tanker'],
    requirements: { licenseClass: 'code_14', specialPermits: ['Hazmat Permit'] },
    pricing: { baseRatePerKm: 18, minimumCharge: 1500 },
    displayOrder: 45,
    isActive: true
  },
  {
    name: 'Flatbed Truck (10-Tonne)',
    category: 'truck',
    subcategory: '10ton',
    description: 'Flatbed truck for oversized cargo',
    capacity: {
      weight: { min: 7, max: 10, unit: 'tonnes' }
    },
    dimensions: { length: 7, width: 2.5, height: 0.3 },
    trailerConfiguration: {
      hasIntegratedTrailer: false,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general', 'bulk'],
    specialCapabilities: ['flatbed', 'crane_equipped'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 13, minimumCharge: 950 },
    displayOrder: 50,
    isActive: true
  },
  {
    name: 'Car Carrier',
    category: 'truck',
    subcategory: '15ton',
    description: 'Specialized truck for vehicle transport',
    capacity: {
      weight: { min: 10, max: 15, unit: 'tonnes' }
    },
    trailerConfiguration: {
      hasIntegratedTrailer: true,
      canAttachTrailer: false,
      requiresTrailer: false
    },
    suitableCargoCategories: ['general'],
    specialCapabilities: ['car_carrier'],
    requirements: { licenseClass: 'code_14' },
    pricing: { baseRatePerKm: 16, minimumCharge: 1800 },
    displayOrder: 55,
    isActive: true
  }
];

// ========================================
// VEHICLE MAKES SEED DATA
// ========================================
const vehicleMakesData = [
  { name: 'Hino', country: 'Japan', isPopular: true },
  { name: 'Isuzu', country: 'Japan', isPopular: true },
  { name: 'Toyota', country: 'Japan', isPopular: true },
  { name: 'Nissan', country: 'Japan', isPopular: true },
  { name: 'Mitsubishi Fuso', country: 'Japan', isPopular: true },
  { name: 'Mercedes-Benz', country: 'Germany', isPopular: true },
  { name: 'MAN', country: 'Germany', isPopular: true },
  { name: 'Scania', country: 'Sweden', isPopular: true },
  { name: 'Volvo', country: 'Sweden', isPopular: true },
  { name: 'DAF', country: 'Netherlands', isPopular: false },
  { name: 'Iveco', country: 'Italy', isPopular: false },
  { name: 'Freightliner', country: 'USA', isPopular: false },
  { name: 'Ford', country: 'USA', isPopular: true },
  { name: 'Tata', country: 'India', isPopular: false },
  { name: 'Ashok Leyland', country: 'India', isPopular: false },
  { name: 'FAW', country: 'China', isPopular: false },
  { name: 'Sinotruk', country: 'China', isPopular: false },
  { name: 'CNHTC (Howo)', country: 'China', isPopular: false },
  { name: 'UD Trucks', country: 'Japan', isPopular: true },
  { name: 'Renault Trucks', country: 'France', isPopular: false }
];

// ========================================
// CARGO TYPES SEED DATA
// ========================================
const cargoTypesData = [
  // General Cargo
  {
    name: 'General Goods',
    category: 'general',
    description: 'Standard packaged goods, boxes, pallets',
    specialRequirements: [],
    packagingTypes: ['boxes', 'pallets', 'crates', 'bags'],
    insuranceCategory: 'general',
    handlingInstructions: 'Standard handling',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.012
  },
  {
    name: 'Furniture',
    category: 'general',
    description: 'Household and office furniture',
    specialRequirements: ['Blanket wrapping', 'Careful handling'],
    packagingTypes: ['blankets', 'shrink_wrap', 'boxes'],
    insuranceCategory: 'general',
    handlingInstructions: 'Handle with care, protect from scratches',
    isFragile: true,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.018
  },
  {
    name: 'Electronics',
    category: 'general',
    description: 'Electronic equipment and appliances',
    specialRequirements: ['Anti-static packaging', 'Temperature sensitive'],
    packagingTypes: ['boxes', 'foam', 'anti_static_bags'],
    insuranceCategory: 'general',
    handlingInstructions: 'Keep dry, handle with care, avoid stacking',
    isFragile: true,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.025
  },
  {
    name: 'Building Materials',
    category: 'general',
    description: 'Construction materials, timber, steel',
    specialRequirements: ['Secure loading'],
    packagingTypes: ['bundles', 'pallets', 'loose'],
    insuranceCategory: 'general',
    handlingInstructions: 'Secure with straps, distribute weight evenly',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.008
  },
  {
    name: 'Machinery',
    category: 'general',
    description: 'Industrial machinery and equipment',
    specialRequirements: ['Heavy equipment handling', 'Secure fastening'],
    packagingTypes: ['crates', 'pallets', 'skids'],
    insuranceCategory: 'general',
    handlingInstructions: 'Use appropriate lifting equipment, secure properly',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.02
  },
  // Bulk Materials
  {
    name: 'Sand',
    category: 'bulk',
    description: 'Building sand, river sand',
    specialRequirements: ['Covered transport', 'Tipper required'],
    packagingTypes: ['loose'],
    insuranceCategory: 'general',
    handlingInstructions: 'Cover during transport, use tipper for unloading',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.005
  },
  {
    name: 'Aggregate/Gravel',
    category: 'bulk',
    description: 'Stones, gravel, crushed rock',
    specialRequirements: ['Covered transport', 'Tipper required'],
    packagingTypes: ['loose'],
    insuranceCategory: 'general',
    handlingInstructions: 'Cover during transport, use tipper for unloading',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.005
  },
  {
    name: 'Maize (Bagged)',
    category: 'bulk',
    description: 'Bagged maize grain',
    specialRequirements: ['Moisture protection', 'Ventilation'],
    packagingTypes: ['bags'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Keep dry, ensure ventilation, check for pests',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.015
  },
  {
    name: 'Maize (Loose Bulk)',
    category: 'bulk',
    description: 'Loose maize grain - tipper load',
    specialRequirements: ['Covered transport', 'Moisture protection'],
    packagingTypes: ['loose'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Cover completely, keep dry, use food-grade container',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.012
  },
  {
    name: 'Wheat (Bagged)',
    category: 'bulk',
    description: 'Bagged wheat grain',
    specialRequirements: ['Moisture protection', 'Ventilation'],
    packagingTypes: ['bags'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Keep dry, ensure ventilation, check for pests',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.015
  },
  {
    name: 'Wheat (Loose Bulk)',
    category: 'bulk',
    description: 'Loose wheat grain',
    specialRequirements: ['Covered transport', 'Moisture protection'],
    packagingTypes: ['loose'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Cover completely, keep dry, use food-grade container',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.012
  },
  {
    name: 'Soya Beans',
    category: 'bulk',
    description: 'Soya beans - bagged or bulk',
    specialRequirements: ['Moisture protection', 'Ventilation'],
    packagingTypes: ['bags', 'loose'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Keep dry, ensure ventilation',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.015
  },
  {
    name: 'Fertilizer',
    category: 'bulk',
    description: 'Agricultural fertilizers',
    specialRequirements: ['Covered transport', 'Keep dry'],
    packagingTypes: ['bags', 'bulk'],
    insuranceCategory: 'agriculture',
    handlingInstructions: 'Keep dry, avoid contamination, check for chemical compatibility',
    moistureSensitivity: 'high',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.01
  },
  {
    name: 'Coal',
    category: 'bulk',
    description: 'Coal for industrial or domestic use',
    specialRequirements: ['Covered transport', 'Dust control'],
    packagingTypes: ['loose'],
    insuranceCategory: 'general',
    handlingInstructions: 'Cover to prevent dust, use tipper for unloading',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.006
  },
  // Liquids
  {
    name: 'Diesel/Petrol',
    category: 'liquid',
    description: 'Petroleum products',
    specialRequirements: ['Hazmat certified', 'Tanker required', 'Fire safety equipment'],
    packagingTypes: ['tanker'],
    insuranceCategory: 'dangerous_goods',
    handlingInstructions: 'No smoking, proper grounding, fire safety protocols',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.035
  },
  {
    name: 'Water',
    category: 'liquid',
    description: 'Potable or industrial water',
    specialRequirements: ['Food-grade tanker for potable'],
    packagingTypes: ['tanker'],
    insuranceCategory: 'general',
    handlingInstructions: 'Use food-grade tanker for drinking water',
    isFragile: false,
    requiresSpecialDocumentation: false,
    baseInsuranceRate: 0.005
  },
  {
    name: 'Milk (Bulk)',
    category: 'liquid',
    description: 'Bulk milk transport',
    specialRequirements: ['Refrigerated tanker', 'Food-grade'],
    packagingTypes: ['tanker'],
    insuranceCategory: 'agriculture',
    temperatureRequirements: { min: 2, max: 6, unit: 'celsius' },
    handlingInstructions: 'Maintain cold chain, use food-grade equipment',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.02
  },
  {
    name: 'Cooking Oil (Bulk)',
    category: 'liquid',
    description: 'Edible oils in bulk',
    specialRequirements: ['Food-grade tanker'],
    packagingTypes: ['tanker'],
    insuranceCategory: 'general',
    handlingInstructions: 'Use food-grade tanker, avoid contamination',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.015
  },
  {
    name: 'Chemicals (Non-Hazardous)',
    category: 'liquid',
    description: 'Industrial chemicals - non-hazardous',
    specialRequirements: ['Chemical-resistant tanker'],
    packagingTypes: ['tanker', 'drums'],
    insuranceCategory: 'general',
    handlingInstructions: 'Check compatibility, avoid mixing',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.02
  },
  // Refrigerated
  {
    name: 'Fresh Produce',
    category: 'refrigerated',
    description: 'Fresh fruits and vegetables',
    specialRequirements: ['Refrigerated truck', 'Temperature monitoring'],
    packagingTypes: ['crates', 'boxes'],
    insuranceCategory: 'agriculture',
    temperatureRequirements: { min: 2, max: 8, unit: 'celsius' },
    handlingInstructions: 'Maintain cold chain, ventilate properly',
    isFragile: true,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.025
  },
  {
    name: 'Frozen Goods',
    category: 'refrigerated',
    description: 'Frozen foods and products',
    specialRequirements: ['Deep freeze truck', 'Temperature monitoring'],
    packagingTypes: ['boxes', 'pallets'],
    insuranceCategory: 'general',
    temperatureRequirements: { min: -25, max: -18, unit: 'celsius' },
    handlingInstructions: 'Maintain deep freeze, do not break cold chain',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.03
  },
  {
    name: 'Meat Products',
    category: 'refrigerated',
    description: 'Fresh or frozen meat',
    specialRequirements: ['Refrigerated truck', 'Hygiene standards'],
    packagingTypes: ['boxes', 'carcasses'],
    insuranceCategory: 'agriculture',
    temperatureRequirements: { min: -2, max: 4, unit: 'celsius' },
    handlingInstructions: 'Maintain hygiene, temperature control critical',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.028
  },
  {
    name: 'Dairy Products',
    category: 'refrigerated',
    description: 'Milk, cheese, yogurt, etc.',
    specialRequirements: ['Refrigerated truck', 'Temperature monitoring'],
    packagingTypes: ['boxes', 'pallets', 'crates'],
    insuranceCategory: 'agriculture',
    temperatureRequirements: { min: 2, max: 6, unit: 'celsius' },
    handlingInstructions: 'Maintain cold chain, check expiry dates',
    isFragile: true,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.022
  },
  {
    name: 'Pharmaceuticals',
    category: 'refrigerated',
    description: 'Temperature-sensitive medicines',
    specialRequirements: ['Temperature controlled', 'Validated transport'],
    packagingTypes: ['boxes', 'insulated_containers'],
    insuranceCategory: 'general',
    temperatureRequirements: { min: 2, max: 8, unit: 'celsius' },
    handlingInstructions: 'Strict temperature control, tamper-evident seals',
    isFragile: true,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.04
  },
  // Hazardous
  {
    name: 'Explosives',
    category: 'hazardous',
    description: 'Explosives and blasting materials',
    specialRequirements: ['Hazmat certified', 'Special permits', 'Police escort'],
    packagingTypes: ['special_containers'],
    insuranceCategory: 'dangerous_goods',
    handlingInstructions: 'Extreme caution, follow all safety protocols',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.08
  },
  {
    name: 'Flammable Liquids',
    category: 'hazardous',
    description: 'Flammable chemicals and solvents',
    specialRequirements: ['Hazmat certified', 'Fire safety equipment'],
    packagingTypes: ['drums', 'tanker'],
    insuranceCategory: 'dangerous_goods',
    handlingInstructions: 'No ignition sources, proper grounding',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.05
  },
  {
    name: 'Corrosive Materials',
    category: 'hazardous',
    description: 'Acids, alkalis, and corrosive chemicals',
    specialRequirements: ['Chemical-resistant containers', 'Hazmat certified'],
    packagingTypes: ['drums', 'special_containers'],
    insuranceCategory: 'dangerous_goods',
    handlingInstructions: 'Avoid contact, use protective equipment',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.045
  },
  {
    name: 'Toxic Substances',
    category: 'hazardous',
    description: 'Toxic chemicals and substances',
    specialRequirements: ['Hazmat certified', 'Sealed containers'],
    packagingTypes: ['drums', 'special_containers'],
    insuranceCategory: 'dangerous_goods',
    handlingInstructions: 'Avoid exposure, use protective equipment',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.055
  },
  // Livestock
  {
    name: 'Cattle',
    category: 'live',
    description: 'Live cattle transport',
    specialRequirements: ['Livestock truck', 'Ventilation', 'Water access'],
    packagingTypes: ['livestock_trailer'],
    insuranceCategory: 'livestock',
    handlingInstructions: 'Proper ventilation, regular stops for water, gentle handling',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.03
  },
  {
    name: 'Sheep/Goats',
    category: 'live',
    description: 'Live sheep and goats transport',
    specialRequirements: ['Livestock truck', 'Ventilation'],
    packagingTypes: ['livestock_trailer'],
    insuranceCategory: 'livestock',
    handlingInstructions: 'Proper ventilation, avoid overcrowding',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.025
  },
  {
    name: 'Pigs',
    category: 'live',
    description: 'Live pig transport',
    specialRequirements: ['Livestock truck', 'Temperature control', 'Ventilation'],
    packagingTypes: ['livestock_trailer'],
    insuranceCategory: 'livestock',
    handlingInstructions: 'Avoid heat stress, proper ventilation, water access',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.028
  },
  {
    name: 'Poultry',
    category: 'live',
    description: 'Live chickens, turkeys, and other poultry',
    specialRequirements: ['Ventilated crates', 'Temperature control'],
    packagingTypes: ['crates'],
    insuranceCategory: 'livestock',
    handlingInstructions: 'Good ventilation, avoid heat stress, gentle handling',
    isFragile: true,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.022
  },
  {
    name: 'Horses',
    category: 'live',
    description: 'Live horse transport',
    specialRequirements: ['Horse box/trailer', 'Padding', 'Attendant'],
    packagingTypes: ['horse_trailer'],
    insuranceCategory: 'livestock',
    handlingInstructions: 'Calm environment, regular stops, experienced handler',
    isFragile: false,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.04
  },
  {
    name: 'Day-Old Chicks',
    category: 'live',
    description: 'Day-old chicks for farms',
    specialRequirements: ['Temperature controlled', 'Ventilation', 'Time-critical'],
    packagingTypes: ['specialized_crates'],
    insuranceCategory: 'livestock',
    temperatureRequirements: { min: 32, max: 35, unit: 'celsius' },
    handlingInstructions: 'Maintain temperature, deliver within 24 hours, gentle handling',
    isFragile: true,
    requiresSpecialDocumentation: true,
    baseInsuranceRate: 0.035
  }
];

// ========================================
// TRAILER TYPES SEED DATA
// ========================================
const trailerTypesData = [
  {
    name: 'Flatbed Trailer',
    category: 'flatbed',
    description: 'Open flatbed trailer for general cargo and oversized loads',
    capacityRange: { min: 20, max: 34, unit: 'tonnes' },
    dimensions: { length: 13.5, width: 2.5, height: 0.3 },
    specialFeatures: ['Side poles', 'Tie-down points', 'Ramps available'],
    requirements: { licenseClass: 'EC', minTowingCapacity: 34000 },
    baseRentalRate: 250
  },
  {
    name: 'Tautliner / Curtain Side',
    category: 'enclosed',
    description: 'Enclosed trailer with curtain sides for easy loading',
    capacityRange: { min: 20, max: 30, unit: 'tonnes' },
    dimensions: { length: 13.5, width: 2.5, height: 2.7 },
    specialFeatures: ['Curtain sides', 'Rear doors', 'Internal straps'],
    requirements: { licenseClass: 'EC', minTowingCapacity: 30000 },
    baseRentalRate: 280
  },
  {
    name: 'Box/Dry Van Trailer',
    category: 'enclosed',
    description: 'Fully enclosed trailer for protected transport',
    capacityRange: { min: 20, max: 28, unit: 'tonnes' },
    dimensions: { length: 13.5, width: 2.5, height: 2.7 },
    specialFeatures: ['Sealed body', 'Rear doors', 'Internal straps', 'Lockable'],
    requirements: { licenseClass: 'EC', minTowingCapacity: 28000 },
    baseRentalRate: 300
  },
  {
    name: 'Refrigerated Trailer (Reefer)',
    category: 'refrigerated',
    description: 'Temperature-controlled trailer for cold chain',
    capacityRange: { min: 18, max: 26, unit: 'tonnes' },
    dimensions: { length: 13.5, width: 2.5, height: 2.6 },
    specialFeatures: ['Temperature control', 'Insulated walls', 'Multi-temp zones', 'GPS temperature monitoring'],
    requirements: { licenseClass: 'EC', minTowingCapacity: 26000 },
    baseRentalRate: 500
  },
  {
    name: 'Tanker Trailer (Fuel)',
    category: 'tanker',
    description: 'Fuel tanker for petroleum products',
    capacityRange: { min: 30000, max: 45000, unit: 'liters' },
    dimensions: { length: 12, width: 2.5, height: 3 },
    specialFeatures: ['Multi-compartment', 'Vapor recovery', 'Grounding cables', 'Flow meters'],
    requirements: { licenseClass: 'EC', specialPermits: ['Hazmat', 'ADR'] },
    baseRentalRate: 450
  },
  {
    name: 'Tanker Trailer (Food Grade)',
    category: 'tanker',
    description: 'Food-grade tanker for milk, oil, water',
    capacityRange: { min: 25000, max: 38000, unit: 'liters' },
    dimensions: { length: 11, width: 2.5, height: 3 },
    specialFeatures: ['Food-grade stainless steel', 'CIP cleaning', 'Insulated'],
    requirements: { licenseClass: 'EC' },
    baseRentalRate: 400
  },
  {
    name: 'Lowbed/Lowboy Trailer',
    category: 'specialized',
    description: 'Low-profile trailer for heavy equipment and machinery',
    capacityRange: { min: 40, max: 80, unit: 'tonnes' },
    dimensions: { length: 14, width: 3, height: 0.5 },
    specialFeatures: ['Hydraulic ramps', 'Removable gooseneck', 'Multi-axle', 'Extendable'],
    requirements: { licenseClass: 'EC1', specialPermits: ['Abnormal Load'] },
    baseRentalRate: 600
  },
  {
    name: 'Tipper/Dump Trailer',
    category: 'specialized',
    description: 'Tipper trailer for bulk materials',
    capacityRange: { min: 20, max: 35, unit: 'tonnes' },
    dimensions: { length: 10, width: 2.5, height: 1.5 },
    specialFeatures: ['Hydraulic tipping', 'Steel body', 'Rear/side discharge'],
    requirements: { licenseClass: 'EC' },
    baseRentalRate: 280
  },
  {
    name: 'Livestock Trailer',
    category: 'specialized',
    description: 'Trailer for transporting live animals',
    capacityRange: { min: 15, max: 25, unit: 'tonnes' },
    dimensions: { length: 13, width: 2.5, height: 3.5 },
    specialFeatures: ['Multi-deck', 'Ventilation', 'Non-slip flooring', 'Water supply', 'Internal partitions'],
    requirements: { licenseClass: 'EC', specialPermits: ['Livestock Transport'] },
    baseRentalRate: 350
  },
  {
    name: 'Car Carrier Trailer',
    category: 'specialized',
    description: 'Multi-level trailer for vehicle transport',
    capacityRange: { min: 6, max: 10, unit: 'vehicles' },
    dimensions: { length: 20, width: 2.5, height: 4.2 },
    specialFeatures: ['Hydraulic ramps', 'Multi-deck', 'Wheel straps', 'Adjustable decks'],
    requirements: { licenseClass: 'EC1' },
    baseRentalRate: 400
  },
  {
    name: 'Container Chassis',
    category: 'flatbed',
    description: 'Skeletal trailer for ISO containers',
    capacityRange: { min: 20, max: 34, unit: 'tonnes' },
    dimensions: { length: 12.2, width: 2.44, height: 1.2 },
    specialFeatures: ['Twist locks', '20ft/40ft compatible', 'Gooseneck', 'Extendable'],
    requirements: { licenseClass: 'EC' },
    baseRentalRate: 200
  },
  {
    name: 'Side Tipper Trailer',
    category: 'specialized',
    description: 'Side-tipping trailer for mining and construction',
    capacityRange: { min: 30, max: 45, unit: 'tonnes' },
    dimensions: { length: 11, width: 2.5, height: 1.8 },
    specialFeatures: ['Side tipping', 'Heavy duty', 'Rock body'],
    requirements: { licenseClass: 'EC' },
    baseRentalRate: 320
  }
];

// ========================================
// INSURANCE OPTIONS SEED DATA
// ========================================
const insuranceOptionsData = [
  // General Insurance Options
  {
    name: 'Basic Transit Cover',
    category: 'general',
    description: 'Basic coverage for general cargo during transit',
    coverageTypes: ['theft', 'damage', 'accident'],
    baseRate: 0.012,
    rateType: 'percentage',
    calculation: { minPremium: 10, maxPremium: 5000 },
    documentRequirements: ['Cargo manifest', 'Delivery note'],
    claimProcess: 'Report within 24 hours, submit photos and documentation',
    exclusions: ['Pre-existing damage', 'Improper packaging', 'Acts of war'],
    isActive: true
  },
  {
    name: 'Standard Transit Cover',
    category: 'general',
    description: 'Standard coverage including weather damage',
    coverageTypes: ['theft', 'damage', 'accident', 'weather'],
    baseRate: 0.018,
    rateType: 'percentage',
    calculation: { minPremium: 20, maxPremium: 10000 },
    documentRequirements: ['Cargo manifest', 'Delivery note', 'Photos'],
    claimProcess: 'Report within 48 hours, submit documentation',
    exclusions: ['Pre-existing damage', 'Acts of war', 'Nuclear events'],
    isActive: true
  },
  {
    name: 'Comprehensive Transit Cover',
    category: 'general',
    description: 'Full coverage for all risks during transit',
    coverageTypes: ['theft', 'damage', 'accident', 'liability', 'transit', 'weather'],
    baseRate: 0.025,
    rateType: 'percentage',
    calculation: { minPremium: 50, maxPremium: 25000 },
    documentRequirements: ['Cargo manifest', 'Delivery note', 'Commercial invoice'],
    claimProcess: 'Report within 72 hours, full documentation required',
    exclusions: ['Intentional damage', 'Nuclear events'],
    isActive: true
  },
  // Dangerous Goods Insurance
  {
    name: 'Hazmat Basic Cover',
    category: 'dangerous_goods',
    description: 'Basic coverage for hazardous materials',
    coverageTypes: ['theft', 'damage', 'accident', 'liability'],
    baseRate: 0.04,
    rateType: 'percentage',
    calculation: { minPremium: 100, maxPremium: 50000 },
    documentRequirements: ['Hazmat manifest', 'Safety data sheets', 'Transport permits'],
    claimProcess: 'Immediate reporting required, environmental assessment',
    exclusions: ['Non-compliance with regulations', 'Improper containment'],
    isActive: true
  },
  {
    name: 'Hazmat Comprehensive Cover',
    category: 'dangerous_goods',
    description: 'Full coverage including environmental liability',
    coverageTypes: ['theft', 'damage', 'accident', 'liability', 'transit', 'weather'],
    baseRate: 0.065,
    rateType: 'percentage',
    calculation: { minPremium: 200, maxPremium: 100000 },
    documentRequirements: ['All hazmat documentation', 'Environmental permits'],
    claimProcess: 'Immediate reporting, environmental cleanup coverage',
    exclusions: ['Deliberate non-compliance'],
    isActive: true
  },
  // Livestock Insurance
  {
    name: 'Livestock Transit Cover',
    category: 'livestock',
    description: 'Coverage for live animal transport',
    coverageTypes: ['death', 'injury', 'theft'],
    baseRate: 0.03,
    rateType: 'percentage',
    calculation: { minPremium: 50, maxPremium: 20000 },
    documentRequirements: ['Veterinary certificate', 'Movement permit', 'Animal count'],
    claimProcess: 'Immediate reporting, veterinary assessment required',
    exclusions: ['Pre-existing conditions', 'Overcrowding', 'Improper ventilation'],
    isActive: true
  },
  {
    name: 'Premium Livestock Cover',
    category: 'livestock',
    description: 'Premium coverage for high-value animals',
    coverageTypes: ['death', 'injury', 'theft', 'disease'],
    baseRate: 0.045,
    rateType: 'percentage',
    calculation: { minPremium: 100, maxPremium: 50000 },
    documentRequirements: ['Veterinary certificate', 'Vaccination records', 'Valuation'],
    claimProcess: 'Immediate reporting, full veterinary documentation',
    exclusions: ['Pre-existing conditions'],
    isActive: true
  },
  // Agriculture Insurance
  {
    name: 'Agricultural Produce Cover',
    category: 'agriculture',
    description: 'Coverage for agricultural products',
    coverageTypes: ['damage', 'spoilage', 'theft', 'weather'],
    baseRate: 0.02,
    rateType: 'percentage',
    calculation: { minPremium: 30, maxPremium: 15000 },
    documentRequirements: ['Phytosanitary certificate', 'Quality certificate'],
    claimProcess: 'Report within 24 hours, quality assessment',
    exclusions: ['Poor harvesting practices', 'Pre-existing contamination'],
    isActive: true
  },
  {
    name: 'Cold Chain Agriculture Cover',
    category: 'agriculture',
    description: 'Coverage for temperature-sensitive agricultural products',
    coverageTypes: ['damage', 'spoilage', 'theft', 'weather', 'temperature_deviation'],
    baseRate: 0.035,
    rateType: 'percentage',
    calculation: { minPremium: 60, maxPremium: 30000 },
    documentRequirements: ['Temperature logs', 'Phytosanitary certificate'],
    claimProcess: 'Immediate reporting, temperature data analysis',
    exclusions: ['Equipment failure due to negligence'],
    isActive: true
  },
  // Hazardous Materials Insurance
  {
    name: 'Explosives Transit Cover',
    category: 'hazardous',
    description: 'Specialized coverage for explosive materials',
    coverageTypes: ['damage', 'accident', 'liability', 'third_party'],
    baseRate: 0.08,
    rateType: 'percentage',
    calculation: { minPremium: 500, maxPremium: 200000 },
    documentRequirements: ['Explosives license', 'Route approval', 'Security clearance'],
    claimProcess: 'Immediate government and insurer notification',
    exclusions: ['Non-compliance with regulations', 'Unauthorized routes'],
    isActive: true
  }
];

// ========================================
// SEED FUNCTIONS
// ========================================

const seedVehicleTypes = async () => {
  console.log('Seeding vehicle types...');
  for (const type of vehicleTypesData) {
    await VehicleType.findOneAndUpdate(
      { name: type.name },
      type,
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${vehicleTypesData.length} vehicle types`);
};

const seedVehicleMakes = async () => {
  console.log('Seeding vehicle makes...');
  for (const make of vehicleMakesData) {
    await VehicleMake.findOneAndUpdate(
      { name: make.name },
      make,
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${vehicleMakesData.length} vehicle makes`);
};

const seedCargoTypes = async () => {
  console.log('Seeding cargo types...');

  // Get vehicle type IDs for linking
  const vehicleTypes = await VehicleType.find({});
  const vehicleTypeMap = {};
  vehicleTypes.forEach(vt => {
    vehicleTypeMap[vt.name] = vt._id;
  });

  for (const cargo of cargoTypesData) {
    // Set recommended vehicle types based on category
    let recommendedTypes = [];
    const addVehicle = (name) => {
      const vehicle = vehicleTypes.find(v => v.name === name);
      if (vehicle && !recommendedTypes.some(id => id.toString() === vehicle._id.toString())) {
        recommendedTypes.push(vehicle._id);
      }
    };

    if (cargo.category === 'live') {
      addVehicle('Livestock Truck');
    } else if (cargo.category === 'refrigerated') {
      const refrigeratedTrucks = vehicleTypes.filter(v => v.specialCapabilities?.includes('refrigerated'));
      recommendedTypes = refrigeratedTrucks.map(v => v._id);
    } else if (cargo.category === 'liquid') {
      addVehicle('Tanker Truck');
    } else if (cargo.category === 'bulk') {
      addVehicle('Tipper Truck (10-Tonne)');
      addVehicle('Truck Tractor (Horse Only)');
    } else if (cargo.category === 'hazardous') {
      addVehicle('Tanker Truck');
      addVehicle('Truck Tractor (Horse Only)');
    } else {
      addVehicle('5-Tonne Truck');
      addVehicle('10-Tonne Truck');
      if (cargo.name === 'Furniture' || cargo.name === 'Electronics') {
        addVehicle('Delivery Van');
        addVehicle('Panel Van');
      }
      if (cargo.name === 'Building Materials' || cargo.name === 'Machinery') {
        addVehicle('Flatbed Truck (10-Tonne)');
        addVehicle('Truck Tractor (Horse Only)');
      }
    }

    await CargoType.findOneAndUpdate(
      { name: cargo.name },
      { ...cargo, recommendedVehicleTypes: recommendedTypes },
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${cargoTypesData.length} cargo types`);
};

const seedTrailerTypes = async () => {
  console.log('Seeding trailer types...');

  // Get cargo type IDs for linking
  const cargoTypes = await CargoType.find({});

  for (const trailer of trailerTypesData) {
    // Set suitable cargo types based on trailer category
    let suitableCargoTypes = [];
    if (trailer.category === 'refrigerated') {
      suitableCargoTypes = cargoTypes.filter(c => c.category === 'refrigerated').map(c => c._id);
    } else if (trailer.category === 'tanker') {
      suitableCargoTypes = cargoTypes.filter(c => c.category === 'liquid').map(c => c._id);
    } else if (trailer.category === 'specialized' && trailer.name.includes('Livestock')) {
      suitableCargoTypes = cargoTypes.filter(c => c.category === 'live').map(c => c._id);
    } else if (trailer.category === 'flatbed' || trailer.category === 'enclosed') {
      suitableCargoTypes = cargoTypes.filter(c => ['general', 'bulk'].includes(c.category)).map(c => c._id);
    }

    await TrailerType.findOneAndUpdate(
      { name: trailer.name },
      { ...trailer, suitableForCargoTypes: suitableCargoTypes },
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${trailerTypesData.length} trailer types`);
};

const linkCargoTypesToTrailers = async () => {
  console.log('Linking cargo types to recommended trailers...');
  const cargoTypes = await CargoType.find({});
  const trailerTypes = await TrailerType.find({});

  for (const cargo of cargoTypes) {
    const recommendedTrailerTypes = trailerTypes
      .filter(trailer => (trailer.suitableForCargoTypes || []).some(id => id.toString() === cargo._id.toString()))
      .map(trailer => trailer._id);

    if (recommendedTrailerTypes.length) {
      await CargoType.findByIdAndUpdate(cargo._id, { recommendedTrailerTypes });
    }
  }

  console.log('✓ Linked cargo types to recommended trailers');
};

const seedInsuranceOptions = async () => {
  console.log('Seeding insurance options...');
  for (const option of insuranceOptionsData) {
    await InsuranceOption.findOneAndUpdate(
      { name: option.name },
      option,
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${insuranceOptionsData.length} insurance options`);
};

const seedInsuranceProviders = async () => {
  console.log('Seeding insurance providers...');
  await InsuranceProvider.seedProviders();
  console.log('✓ Seeded insurance providers');
};

const linkVehicleTypesToTrailers = async () => {
  console.log('Linking vehicle types to compatible trailers...');

  const trailerTypes = await TrailerType.find({});
  const tractors = await VehicleType.find({ category: 'tractor' });

  for (const tractor of tractors) {
    // Tractors can attach all trailer types
    await VehicleType.findByIdAndUpdate(tractor._id, {
      'trailerConfiguration.compatibleTrailerTypes': trailerTypes.map(t => t._id)
    });
  }

  console.log('✓ Linked vehicle types to trailers');
};

// ========================================
// MAIN SEED FUNCTION
// ========================================

const seedAll = async ({ connect = true, exit = false } = {}) => {
  try {
    if (connect) {
      await connectDB();
    }

    console.log('\n========================================');
    console.log('PALMTRENT REFERENCE DATA SEEDER');
    console.log('========================================\n');

    // Seed in order (some depend on others)
    await seedVehicleTypes();
    await seedVehicleMakes();
    await seedCargoTypes();
    await seedTrailerTypes();
    await linkCargoTypesToTrailers();
    await seedInsuranceOptions();
    await seedInsuranceProviders();
    await linkVehicleTypesToTrailers();

    console.log('\n========================================');
    console.log('✓ ALL REFERENCE DATA SEEDED SUCCESSFULLY');
    console.log('========================================\n');

    const summary = {
      vehicleTypes: vehicleTypesData.length,
      vehicleMakes: vehicleMakesData.length,
      cargoTypes: cargoTypesData.length,
      trailerTypes: trailerTypesData.length,
      insuranceOptions: insuranceOptionsData.length
    };

    if (exit) process.exit(0);
    return summary;
  } catch (error) {
    console.error('Seeding error:', error);
    if (exit) process.exit(1);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  seedAll({ connect: true, exit: true });
}

module.exports = { seedAll };
