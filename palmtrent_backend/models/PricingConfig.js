const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema({
  configName: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  
  // Base transport fees per km by vehicle type
  baseRates: {
    bakkie: { type: Number, default: 0.50 },        // USD per km
    '3ton': { type: Number, default: 0.75 },
    '7ton': { type: Number, default: 1.00 },
    '10ton': { type: Number, default: 1.25 },
    '20ton': { type: Number, default: 1.50 },
    truck_tractor: { type: Number, default: 1.75 }
  },

  transportCommission: {
     enabled: { type: Boolean, default: true },
     rate: { type: Number, default: 0.15 }, // 15% commission from transporter
     minimumCommission: { type: Number, default: 5 }
  },
  
  // Minimum base transport fee regardless of distance
  minimumTransportFee: {
    type: Number,
    default: 50 // USD
  },
  
  // Platform commission rates by payment method
  platformFees: {
    digital: {
      rate: { type: Number, default: 0.12 },        // 12%
      description: { type: String, default: 'EcoCash/OneMoney/Bank Transfer' }
    },
    cashViaAgent: {
      rate: { type: Number, default: 0.12 },        // 12%
      description: { type: String, default: 'Cash via EcoCash Agent' }
    },
    cashOnPickup: {
      rate: { type: Number, default: 0.15 },        // 15%
      description: { type: String, default: 'Driver collects at pickup' }
    },
    cashOnDelivery: {
      rate: { type: Number, default: 0.15 },        // 15% — same as cash on pickup
      description: { type: String, default: 'Recipient pays driver' }
    },
    corporateNet30: {
      rate: { type: Number, default: 0.10 },        // 10%
      surcharge: { type: Number, default: 0.00 },   // No surcharge for Net 30
      description: { type: String, default: 'Corporate Net 30 days' }
    },
    corporateNet60: {
      rate: { type: Number, default: 0.10 },        // 10%
      surcharge: { type: Number, default: 0.02 },   // +2% surcharge
      description: { type: String, default: 'Corporate Net 60 days' }
    },
    corporateNet90: {
      rate: { type: Number, default: 0.10 },        // 10%
      surcharge: { type: Number, default: 0.04 },   // +4% surcharge
      description: { type: String, default: 'Corporate Net 90 days' }
    }
  },
  
  // Insurance rates
  insurance: {
    baseRate: { type: Number, default: 0.0045 },    // 0.45% of cargo value
    minimumPremium: { type: Number, default: 15 },  // USD
    crossBorderRate: { type: Number, default: 0.025 }, // 2.5% for cross-border
    hazmatMultiplier: { type: Number, default: 2.0 },  // 2x for hazardous materials
    livestockMultiplier: { type: Number, default: 1.5 }, // 1.5x for livestock
    agricultureMultiplier: { type: Number, default: 1.3 } // 1.3x for agriculture
  },
  
  // Cross-border surcharges
  crossBorder: {
    baseSurcharge: { type: Number, default: 50 },   // USD
    documentationFee: { type: Number, default: 30 }, // USD
    insurancePremium: { type: Number, default: 50 }, // Additional insurance
    platformFeeIncrease: { type: Number, default: 0.02 } // +2% platform fee
  },
  
  // Volume discounts for multiple vehicles
  volumeDiscounts: {
    threeToFour: { type: Number, default: 0.10 },   // 10% discount
    fiveToNine: { type: Number, default: 0.15 },    // 15% discount
    tenPlus: { type: Number, default: 0.20 }        // 20% discount
  },
  
  // Distance-based multipliers (for very long/short trips)
  distanceMultipliers: {
    under50km: { type: Number, default: 1.2 },      // 20% premium for short trips
    over1000km: { type: Number, default: 0.95 }     // 5% discount for long hauls
  },
  
  // Urgency premiums
  urgency: {
    sameDay: { type: Number, default: 0.25 },       // 25% premium
    nextDay: { type: Number, default: 0.15 },       // 15% premium
    express: { type: Number, default: 0.30 }        // 30% premium
  },
  
  // Fuel surcharge (adjustable based on fuel prices)
  fuelSurcharge: {
    enabled: { type: Boolean, default: true },
    rate: { type: Number, default: 0.05 }           // 5% fuel surcharge
  },
  
  // Special cargo handling fees
  specialCargo: {
    fragile: { type: Number, default: 20 },         // USD flat fee
    refrigerated: { type: Number, default: 50 },    // USD flat fee
    hazmat: { type: Number, default: 100 },         // USD flat fee
    oversized: { type: Number, default: 75 }        // USD flat fee
  },
  
  // Peak season multiplier
  peakSeason: {
    enabled: { type: Boolean, default: false },
    multiplier: { type: Number, default: 1.15 },    // 15% increase
    startMonth: { type: Number, default: 11 },      // November
    endMonth: { type: Number, default: 1 }          // January
  },
  
  // Return load discount (when driver has return load guaranteed)
  returnLoadDiscount: {
    type: Number,
    default: 0.10 // 10% discount if return load confirmed
  },
  
  active: {
    type: Boolean,
    default: true
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notes: String
}, {
  timestamps: true
});

// Index for quick lookups
pricingConfigSchema.index({ active: 1, configName: 1 });

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);