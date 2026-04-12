// scripts/seedPricingConfig.js
const mongoose = require('mongoose');
const PricingConfig = require('../models/PricingConfig');

const initialPricingConfig = {
  configName: 'zim-pricing-v1',
  
  // Base transport fees per km by vehicle type
  baseRates: {
    bakkie: 1.0,        // USD per km
    '3ton': 1.75,
    '7ton': 2.25,
    '10ton': 2.85,
    '20ton': 3.5,
    truck_tractor: 4.00
  },
  
  // Minimum base transport fee regardless of distance
  minimumTransportFee: 25, // USD
  
  // Platform commission rates from transporter earnings
  transportCommission: {
    enabled :true,
    rate:0.15,
    minimumCommission:5
  },


  // Platform commission rates by payment method
  platformFees: {
    digital: {
      rate: 0.085,        // 8.5%
      description: 'EcoCash/OneMoney/Bank Transfer'
    },
    cashViaAgent: {
      rate: 0.09,        // 9%
      description: 'Cash via EcoCash Agent'
    },
    cashOnPickup: {
      rate: 0.15,        // 15%
      description: 'Driver collects at pickup'
    },
    cashOnDelivery: {
      rate: 0.18,        // 18%
      description: 'Recipient pays driver'
    },
    corporateNet30: {
      rate: 0.10,        // 10%
      surcharge: 0.00,   // No surcharge for Net 30
      description: 'Corporate Net 30 days'
    },
    corporateNet60: {
      rate: 0.10,        // 10%
      surcharge: 0.02,   // +2% surcharge
      description: 'Corporate Net 60 days'
    },
    corporateNet90: {
      rate: 0.10,        // 10%
      surcharge: 0.04,   // +4% surcharge
      description: 'Corporate Net 90 days'
    }
  },
  
  // Insurance rates
  insurance: {
    baseRate: 0.0045,    // 0.45% of cargo value
    minimumPremium: 15,  // USD
    crossBorderRate: 0.025, // 2.5% for cross-border
    hazmatMultiplier: 2.0,  // 2x for hazardous materials
    livestockMultiplier: 1.5, // 1.5x for livestock
    agricultureMultiplier: 1.3 // 1.3x for agriculture
  },
  
  // Cross-border surcharges
  crossBorder: {
    baseSurcharge: 50,   // USD
    documentationFee: 30, // USD
    insurancePremium: 50, // Additional insurance
    platformFeeIncrease: 0.02 // +2% platform fee
  },
  
  // Volume discounts for multiple vehicles
  volumeDiscounts: {
    threeToFour: 0.10,   // 10% discount
    fiveToNine: 0.15,    // 15% discount
    tenPlus: 0.20        // 20% discount
  },
  
  // Distance-based multipliers (for very long/short trips)
  distanceMultipliers: {
    under50km: 1.2,      // 20% premium for short trips
    over1000km: 0.95     // 5% discount for long hauls
  },
  
  // Urgency premiums
  urgency: {
    sameDay: 0.25,       // 25% premium
    nextDay: 0.15,       // 15% premium
    express: 0.30        // 30% premium
  },
  
  // Fuel surcharge (adjustable based on fuel prices)
  fuelSurcharge: {
    enabled: true,
    rate: 0.05           // 5% fuel surcharge
  },
  
  // Special cargo handling fees
  specialCargo: {
    fragile: 20,         // USD flat fee
    refrigerated: 50,    // USD flat fee
    hazmat: 100,         // USD flat fee
    oversized: 75        // USD flat fee
  },
  
  // Peak season multiplier
  peakSeason: {
    enabled: false,
    multiplier: 1.15,    // 15% increase
    startMonth: 11,      // November
    endMonth: 1          // January
  },
  
  // Return load discount (when driver has return load guaranteed)
  returnLoadDiscount: 0.10, // 10% discount if return load confirmed
  
  active: true,
  notes: 'Initial pricing configuration for Zimbabwe transport market'
};

async function seedPricingConfig() {
  try {
    console.log('Starting pricing configuration seeding...');
    
    // Deactivate any existing active configs
    await PricingConfig.updateMany({ active: true }, { active: false });
    console.log('Deactivated existing active configurations');
    
    // Create new config
    const config = await PricingConfig.create(initialPricingConfig);
    
    console.log('✅ Pricing configuration seeded successfully!');
    console.log(`Config ID: ${config._id}`);
    console.log(`Config Name: ${config.configName}`);
    console.log('Vehicle Base Rates:');
    Object.entries(config.baseRates).forEach(([vehicle, rate]) => {
      console.log(`  ${vehicle}: $${rate}/km`);
    });
    console.log(`Minimum Transport Fee: $${config.minimumTransportFee}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding pricing config:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config();
  
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_db';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return seedPricingConfig();
    })
    .catch(error => {
      console.error('Database connection error:', error);
      process.exit(1);
    });
}

module.exports = seedPricingConfig;