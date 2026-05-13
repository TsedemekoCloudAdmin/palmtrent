// models/InsuranceProvider.js
const mongoose = require('mongoose');

const insuranceProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  displayName: {
    type: String,
    required: true
  },
  logo: String,
  description: String,
  contactInfo: {
    email: String,
    phone: String,
    website: String,
    claimsPhone: String,
    claimsEmail: String
  },
  address: {
    street: String,
    city: String,
    country: { type: String, default: 'Zimbabwe' }
  },
  products: [{
    productCode: String,
    productName: String,
    description: String,
    coverageType: {
      type: String,
      enum: ['basic', 'standard', 'comprehensive', 'premium']
    },
    coveragePercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    premiumRate: {
      type: Number,
      required: true
    },
    excessAmount: Number,
    excessPercentage: Number,
    maxCoverage: Number,
    minPremium: Number,
    cargoTypes: [{
      type: String,
      enum: ['general', 'fragile', 'perishable', 'hazmat', 'livestock', 'vehicles', 'machinery', 'agricultural', 'electronics']
    }],
    exclusions: [String],
    termsAndConditions: String,
    claimProcessingDays: Number,
    active: { type: Boolean, default: true }
  }],
  rating: {
    overall: { type: Number, min: 0, max: 5, default: 0 },
    claimsProcessing: { type: Number, min: 0, max: 5, default: 0 },
    customerService: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  statistics: {
    totalPolicies: { type: Number, default: 0 },
    totalClaims: { type: Number, default: 0 },
    approvedClaims: { type: Number, default: 0 },
    rejectedClaims: { type: Number, default: 0 },
    averageClaimProcessingDays: { type: Number, default: 0 },
    claimApprovalRate: { type: Number, default: 0 }
  },
  apiConfig: {
    enabled: { type: Boolean, default: false },
    baseUrl: String,
    apiKey: String,
    webhookUrl: String
  },
  commissionRate: {
    type: Number,
    default: 0.15
  },
  priority: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Get quote from provider for given cargo
insuranceProviderSchema.methods.getQuote = function(cargoValue, cargoType, coverageType = 'standard') {
  const product = this.products.find(p =>
    p.active &&
    p.coverageType === coverageType &&
    (p.cargoTypes.includes(cargoType) || p.cargoTypes.includes('general'))
  );

  if (!product) {
    return null;
  }

  let premium = cargoValue * product.premiumRate;

  // Apply minimum premium
  if (product.minPremium && premium < product.minPremium) {
    premium = product.minPremium;
  }

  // Calculate excess
  let excess = product.excessAmount || 0;
  if (product.excessPercentage) {
    excess = Math.max(excess, cargoValue * product.excessPercentage);
  }

  // Calculate coverage
  let coverageAmount = cargoValue * (product.coveragePercentage / 100);
  if (product.maxCoverage && coverageAmount > product.maxCoverage) {
    coverageAmount = product.maxCoverage;
  }

  return {
    providerId: this._id,
    providerCode: this.code,
    providerName: this.displayName,
    productCode: product.productCode,
    productName: product.productName,
    coverageType: product.coverageType,
    cargoValue,
    premium: Math.round(premium * 100) / 100,
    excess: Math.round(excess * 100) / 100,
    coverageAmount: Math.round(coverageAmount * 100) / 100,
    coveragePercentage: product.coveragePercentage,
    exclusions: product.exclusions,
    claimProcessingDays: product.claimProcessingDays,
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    rating: this.rating.overall
  };
};

// Static: Get all active providers
insuranceProviderSchema.statics.getActiveProviders = function() {
  return this.find({ active: true }).sort({ priority: -1, 'rating.overall': -1 });
};

// Static: Get quotes from all providers
insuranceProviderSchema.statics.getAllQuotes = async function(cargoValue, cargoType, coverageType = 'standard') {
  const providers = await this.getActiveProviders();
  const quotes = [];

  for (const provider of providers) {
    const quote = provider.getQuote(cargoValue, cargoType, coverageType);
    if (quote) {
      quotes.push(quote);
    }
  }

  // Sort by premium (lowest first)
  return quotes.sort((a, b) => a.premium - b.premium);
};

// Static: Seed default providers
insuranceProviderSchema.statics.seedProviders = async function() {
  const defaultProviders = [
    {
      name: 'Zimnat Lion Insurance',
      code: 'ZIMNAT',
      displayName: 'Zimnat Lion Insurance',
      description: 'Leading insurance provider in Zimbabwe with comprehensive cargo coverage',
      contactInfo: {
        email: 'info@zimnat.co.zw',
        phone: '+263 4 758 881',
        website: 'https://www.zimnat.co.zw',
        claimsEmail: 'claims@zimnat.co.zw'
      },
      products: [
        {
          productCode: 'ZIM-BASIC',
          productName: 'Basic Cargo Cover',
          coverageType: 'basic',
          coveragePercentage: 70,
          premiumRate: 0.012,
          excessAmount: 50,
          minPremium: 10,
          cargoTypes: ['general', 'agricultural'],
          claimProcessingDays: 14
        },
        {
          productCode: 'ZIM-STD',
          productName: 'Standard Cargo Cover',
          coverageType: 'standard',
          coveragePercentage: 85,
          premiumRate: 0.015,
          excessAmount: 25,
          minPremium: 15,
          cargoTypes: ['general', 'fragile', 'agricultural', 'electronics'],
          claimProcessingDays: 10
        },
        {
          productCode: 'ZIM-COMP',
          productName: 'Comprehensive Cargo Cover',
          coverageType: 'comprehensive',
          coveragePercentage: 100,
          premiumRate: 0.02,
          excessAmount: 0,
          minPremium: 25,
          cargoTypes: ['general', 'fragile', 'perishable', 'agricultural', 'electronics', 'machinery'],
          claimProcessingDays: 7
        }
      ],
      rating: { overall: 4.2, claimsProcessing: 4.0, customerService: 4.3 },
      priority: 10
    },
    {
      name: 'Nicoz Diamond Insurance',
      code: 'NICOZ',
      displayName: 'Nicoz Diamond Insurance',
      description: 'Trusted insurance partner for commercial freight',
      contactInfo: {
        email: 'info@nicoz.co.zw',
        phone: '+263 4 707 831',
        website: 'https://www.nicoz.co.zw',
        claimsEmail: 'claims@nicoz.co.zw'
      },
      products: [
        {
          productCode: 'NIC-BASIC',
          productName: 'Essential Cover',
          coverageType: 'basic',
          coveragePercentage: 70,
          premiumRate: 0.011,
          excessAmount: 60,
          minPremium: 8,
          cargoTypes: ['general'],
          claimProcessingDays: 21
        },
        {
          productCode: 'NIC-STD',
          productName: 'Standard Cover',
          coverageType: 'standard',
          coveragePercentage: 85,
          premiumRate: 0.014,
          excessAmount: 30,
          minPremium: 12,
          cargoTypes: ['general', 'fragile', 'agricultural'],
          claimProcessingDays: 14
        },
        {
          productCode: 'NIC-COMP',
          productName: 'Full Cover',
          coverageType: 'comprehensive',
          coveragePercentage: 100,
          premiumRate: 0.018,
          excessAmount: 10,
          minPremium: 20,
          cargoTypes: ['general', 'fragile', 'perishable', 'agricultural', 'electronics'],
          claimProcessingDays: 10
        }
      ],
      rating: { overall: 4.0, claimsProcessing: 3.8, customerService: 4.2 },
      priority: 8
    },
    {
      name: 'First Mutual Insurance',
      code: 'FIRSTMUTUAL',
      displayName: 'First Mutual Insurance',
      description: 'Reliable insurance solutions for your cargo',
      contactInfo: {
        email: 'info@firstmutual.co.zw',
        phone: '+263 4 700 660',
        website: 'https://www.firstmutual.co.zw',
        claimsEmail: 'claims@firstmutual.co.zw'
      },
      products: [
        {
          productCode: 'FM-STD',
          productName: 'Standard Protection',
          coverageType: 'standard',
          coveragePercentage: 85,
          premiumRate: 0.0145,
          excessAmount: 35,
          minPremium: 15,
          cargoTypes: ['general', 'fragile', 'agricultural'],
          claimProcessingDays: 12
        },
        {
          productCode: 'FM-COMP',
          productName: 'Premium Protection',
          coverageType: 'comprehensive',
          coveragePercentage: 100,
          premiumRate: 0.019,
          excessAmount: 15,
          minPremium: 22,
          cargoTypes: ['general', 'fragile', 'perishable', 'agricultural', 'electronics', 'machinery'],
          claimProcessingDays: 8
        }
      ],
      rating: { overall: 4.1, claimsProcessing: 4.2, customerService: 4.0 },
      priority: 7
    },
    {
      name: 'Old Mutual Insurance',
      code: 'OLDMUTUAL',
      displayName: 'Old Mutual Insurance',
      description: 'Century of trust in insurance services',
      contactInfo: {
        email: 'info@oldmutual.co.zw',
        phone: '+263 4 799 711',
        website: 'https://www.oldmutual.co.zw',
        claimsEmail: 'claims@oldmutual.co.zw'
      },
      products: [
        {
          productCode: 'OM-STD',
          productName: 'Cargo Shield Standard',
          coverageType: 'standard',
          coveragePercentage: 85,
          premiumRate: 0.016,
          excessAmount: 20,
          minPremium: 18,
          cargoTypes: ['general', 'fragile', 'agricultural', 'electronics'],
          claimProcessingDays: 10
        },
        {
          productCode: 'OM-COMP',
          productName: 'Cargo Shield Complete',
          coverageType: 'comprehensive',
          coveragePercentage: 100,
          premiumRate: 0.022,
          excessAmount: 0,
          minPremium: 30,
          cargoTypes: ['general', 'fragile', 'perishable', 'hazmat', 'livestock', 'vehicles', 'machinery', 'agricultural', 'electronics'],
          claimProcessingDays: 5
        }
      ],
      rating: { overall: 4.5, claimsProcessing: 4.6, customerService: 4.4 },
      priority: 9
    }
  ];

  for (const providerData of defaultProviders) {
    await this.findOneAndUpdate(
      { code: providerData.code },
      providerData,
      { upsert: true, new: true }
    );
  }

  console.log('Insurance providers seeded successfully');
};

// Indexes
insuranceProviderSchema.index({ active: 1 });
insuranceProviderSchema.index({ priority: -1 });

module.exports = mongoose.model('InsuranceProvider', insuranceProviderSchema);
