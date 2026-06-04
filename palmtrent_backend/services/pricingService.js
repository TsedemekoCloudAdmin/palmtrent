const PricingConfig = require('../models/PricingConfig');
const monetizationService = require('./monetizationService');

class PricingService {
  
  /**
   * Get active pricing configuration
   */
  async getActivePricingConfig() {
    let config = await PricingConfig.findOne({ active: true });
    
    // Create default if none exists
    if (!config) {
      config = await PricingConfig.create({ configName: 'default', active: true });
    }
    
    return config;
  }
  
  /**
   * Calculate comprehensive pricing for a booking
   */
  async calculatePricing(bookingData) {
    const config = await this.getActivePricingConfig();
    console.log(config);
    
    // Step 1: Calculate base transport fee (goes to transporter)
    let baseTransportFee = this.calculateBaseTransportFee(bookingData, config);
    console.log("base transport fee : "+baseTransportFee);
    
    // Step 2: Apply distance multipliers
    baseTransportFee = this.applyDistanceMultipliers(baseTransportFee, bookingData, config);
    console.log("base transport fee with Multiplier : "+baseTransportFee);

    // Step 3: Apply volume discounts (multiple vehicles)
    baseTransportFee = this.applyVolumeDiscounts(baseTransportFee, bookingData, config);
    console.log("base transport fee with Volume Discounts : "+baseTransportFee);

    // Step 4: Apply urgency premiums
    baseTransportFee = this.applyUrgencyPremium(baseTransportFee, bookingData, config);
    console.log("base transport fee with Urgency : "+baseTransportFee);
    
    // Step 5: Apply fuel surcharge
    baseTransportFee = this.applyFuelSurcharge(baseTransportFee, config);
    console.log("base transport fee with Fuel : "+baseTransportFee);
    
    // Step 6: Apply special cargo fees
    const specialCargoFee = this.calculateSpecialCargoFees(bookingData, config);
    baseTransportFee += specialCargoFee;
    console.log("base transport fee with cargo fee : "+baseTransportFee);
    
    // Step 7: Apply peak season multiplier
    baseTransportFee = this.applyPeakSeasonMultiplier(baseTransportFee, config);
    
    // Step 8: Apply return load discount
    baseTransportFee = this.applyReturnLoadDiscount(baseTransportFee, bookingData, config);
    
    // Step 9: Apply cross-border surcharges
    const crossBorderFees = this.calculateCrossBorderFees(bookingData, config);
    
    // Step 10: Calculate platform fee based on payment method (goes to platform)
    const platformFeeData = await this.calculatePlatformFee(
      baseTransportFee + crossBorderFees.total,
      bookingData.paymentMethod,
      bookingData.isCrossBorder,
      config,
      bookingData
    );
    
    // Step 11: Calculate insurance (goes to insurance provider)
    const insuranceFee = this.calculateInsurance(bookingData, config);

    // Step 12: Calculate totals
    const subtotal = baseTransportFee + crossBorderFees.total + platformFeeData.platformFee + insuranceFee;
    const total = Math.round(subtotal * 100) / 100; // Round to 2 decimal places
    
    // Calculate transporter earnings (base transport fee + cross-border fees)
    const transporterEarnings = baseTransportFee + crossBorderFees.total;    
    const commissionData = await this.calculateTransporterCommission(
       transporterEarnings, 
       bookingData,
       config
    );
    const transporterNetEarnings = transporterEarnings - commissionData.commission;
    return {
  breakdown: {
    // Transporter gets this amount (after commission)
        transporterEarnings: Math.round(transporterNetEarnings),
        transporterGrossEarnings: Math.round(transporterEarnings),
        transporterCommission: Math.round(commissionData.commission),
        transporterCommissionRate: commissionData.rate,
        baseTransportFee: Math.round(baseTransportFee),
        specialCargoFee: Math.round(specialCargoFee),
        crossBorderFees: {
          baseSurcharge: crossBorderFees.baseSurcharge,
          documentationFee: crossBorderFees.documentationFee,
          insurancePremium: crossBorderFees.insurancePremium,
          total: crossBorderFees.total
        },
        
        // Platform keeps this amount
        platformFee: Math.round(platformFeeData.platformFee),
        platformFeeRate: platformFeeData.rate,
        paymentMethod: bookingData.paymentMethod || 'digital',
        
        // Insurance provider gets this amount
        insurance: Math.round(insuranceFee),
        insuranceRate: bookingData.insurance?.required ? config.insurance.baseRate : 0
      },
      totals: {
    subtotal: Math.round(subtotal),
    total: Math.round(total),
    // Clear separation of who gets what
    platformTotal: Math.round(platformFeeData.platformFee + commissionData.commission),
    transporterTotal: Math.round(transporterNetEarnings),
    insuranceTotal: Math.round(insuranceFee)
  },
  feeAllocation: {
    platform: {
      amount: Math.round(platformFeeData.platformFee + commissionData.commission),
      description: `Platform fee (${(platformFeeData.rate * 100).toFixed(1)}%) + Transporter commission (${(commissionData.rate * 100).toFixed(1)}%)`,
      breakdown: {
        platformFee: Math.round(platformFeeData.platformFee),
        transporterCommission: Math.round(commissionData.commission)
      }
    },
    transporter: {
      amount: Math.round(transporterNetEarnings),
      description: 'Transport service fee (after commission)',
      grossAmount: Math.round(transporterEarnings),
      commission: Math.round(commissionData.commission)
    },
        insurance: {
          amount: Math.round(insuranceFee),
          description: 'Cargo insurance',
          type: 'insurance'
        }
      },
      discountsApplied: this.getAppliedDiscounts(bookingData, config),
      surchargesApplied: this.getAppliedSurcharges(bookingData, config),
      configVersion: config._id,
      calculatedAt: new Date()
    };
  }
  
  /**
   * Calculate base transport fee based on distance and vehicle type
   * This amount goes to the transporter
   */
  calculateBaseTransportFee(bookingData, config) {
    const distance = bookingData.route?.distance || 0;
    console.log("distance : "+distance);
    const vehicleType = this.normalizeVehicleType(
      bookingData.vehicles?.[0]?.vehicleType || bookingData.vehicleType || '7ton'
    );

    console.log("vehicle type :"+vehicleType);
    
    const ratePerKm = config.baseRates[vehicleType] || config.baseRates['7ton'];
    let baseFee = distance * ratePerKm;
    
    // Apply minimum fee
    if (baseFee < config.minimumTransportFee) {
      baseFee = config.minimumTransportFee;
    }
    
    return baseFee;
  }
  
  /**
   * Calculate platform fee based on payment method
   * This amount goes to the platform
   */
  async calculatePlatformFee(baseAmount, paymentMethod = 'digital', isCrossBorder = false, config, bookingData = {}) {
    const monetizationFees = await monetizationService.calculateShipmentFees(baseAmount, baseAmount, {
      audience: bookingData.corporateAccount || bookingData.userType === 'corporate' ? 'corporate' : 'all',
      paymentMethod,
      accountTier: bookingData.transporter?.tier || 'all'
    });
    if (monetizationFees.rule) {
      let rate = monetizationFees.platformFeeRate;
      if (isCrossBorder) {
        rate += config.crossBorder.platformFeeIncrease || 0;
      }
      return {
        platformFee: baseAmount * rate,
        rate,
        description: monetizationFees.rule.name,
        method: paymentMethod
      };
    }

    const method = paymentMethod.toLowerCase().replace(/[_-]/g, '');
    let feeConfig;
    
    // Map payment method to config
    switch (method) {
      case 'digital':
      case 'clicknpay':
      case 'openapiafrica':
      case 'openapi_africa':
      case 'card':
      case 'ecocash':
      case 'onemoney':
      case 'bank':
      case 'banktransfer':
        feeConfig = config.platformFees.digital;
        break;
      case 'cashviaagent':
      case 'agent':
      case 'cash_agent':
        feeConfig = config.platformFees.cashViaAgent;
        break;
      case 'cashonpickup':
      case 'pickup':
      case 'cash_on_pickup':
        feeConfig = config.platformFees.cashOnPickup;
        break;
      case 'cashondelivery':
      case 'delivery':
      case 'cod':
      case 'cash_on_delivery':
        feeConfig = config.platformFees.cashOnDelivery;
        break;
      case 'corporatenet30':
      case 'net30':
        feeConfig = config.platformFees.corporateNet30;
        break;
      case 'corporatenet60':
      case 'net60':
        feeConfig = config.platformFees.corporateNet60;
        break;
      case 'corporatenet90':
      case 'net90':
        feeConfig = config.platformFees.corporateNet90;
        break;
      default:
        feeConfig = config.platformFees.digital;
    }
    
    let rate = feeConfig.rate;
    
    // Add credit term surcharge if applicable
    if (feeConfig.surcharge) {
      rate += feeConfig.surcharge;
    }
    
    // Add cross-border platform fee increase
    if (isCrossBorder) {
      rate += config.crossBorder.platformFeeIncrease;
    }
    
    const platformFee = baseAmount * rate;
    
    return {
      platformFee,
      rate,
      description: feeConfig.description,
      method: method
    };
  }

  /**
   * Get payment method description for display
   */
  getPaymentMethodDescription(paymentMethod) {
    const method = paymentMethod?.toLowerCase().replace(/[_-]/g, '') || 'digital';
    
    const descriptions = {
      'clicknpay': 'ClicknPay Checkout',
      'openapiafrica': 'ClicknPay Checkout',
      'openapi_africa': 'ClicknPay Checkout',
      'card': 'Card via ClicknPay',
      'ecocash': 'EcoCash',
      'onemoney': 'OneMoney',
      'bank': 'Bank Transfer',
      'banktransfer': 'Bank Transfer',
      'cashviaagent': 'Cash via EcoCash Agent',
      'cashagent': 'Cash via EcoCash Agent',
      'cashonpickup': 'Cash on Pickup',
      'cashondelivery': 'Cash on Delivery',
      'digital': 'Digital Payment'
    };
    
    return descriptions[method] || 'Digital Payment';
  }
  
  /**
   * Apply distance-based multipliers
   */
  applyDistanceMultipliers(baseFee, bookingData, config) {
    const distance = bookingData.route?.distance || 0;
    
    if (distance < 50) {
      return baseFee * config.distanceMultipliers.under50km;
    } else if (distance > 1000) {
      return baseFee * config.distanceMultipliers.over1000km;
    }
    
    return baseFee;
  }
  
  /**
   * Apply volume discounts for multiple vehicles
   */
  applyVolumeDiscounts(baseFee, bookingData, config) {
    if (bookingData.bookingType !== 'multiple' || !bookingData.vehicles?.length) {
      return baseFee;
    }
    
    const vehicleCount = bookingData.vehicles.length;
    let totalFee = baseFee * vehicleCount;
    
    if (vehicleCount >= 10) {
      totalFee *= (1 - config.volumeDiscounts.tenPlus);
    } else if (vehicleCount >= 5) {
      totalFee *= (1 - config.volumeDiscounts.fiveToNine);
    } else if (vehicleCount >= 3) {
      totalFee *= (1 - config.volumeDiscounts.threeToFour);
    }
    
    return totalFee;
  }
  
  /**
   * Apply urgency premiums
   */
  applyUrgencyPremium(baseFee, bookingData, config) {
    const urgency = bookingData.urgency?.toLowerCase();
    
    if (urgency === 'express') {
      return baseFee * (1 + config.urgency.express);
    } else if (urgency === 'same_day' || urgency === 'sameday') {
      return baseFee * (1 + config.urgency.sameDay);
    } else if (urgency === 'next_day' || urgency === 'nextday') {
      return baseFee * (1 + config.urgency.nextDay);
    }
    
    return baseFee;
  }
  
  /**
   * Apply fuel surcharge
   */
  applyFuelSurcharge(baseFee, config) {
    if (config.fuelSurcharge.enabled) {
      return baseFee * (1 + config.fuelSurcharge.rate);
    }
    return baseFee;
  }
  
  /**
   * Calculate special cargo handling fees
   */
  calculateSpecialCargoFees(bookingData, config) {
    let fees = 0;
    const cargoType = bookingData.cargoDetails?.type?.toLowerCase() || '';
    const specialRequirements = bookingData.cargoDetails?.specialRequirements || [];
    
    if (cargoType.includes('fragile') || specialRequirements.includes('fragile')) {
      fees += config.specialCargo.fragile;
    }
    if (cargoType.includes('refrigerat') || specialRequirements.includes('refrigerated')) {
      fees += config.specialCargo.refrigerated;
    }
    if (cargoType.includes('hazmat') || cargoType.includes('hazardous') || specialRequirements.includes('hazmat')) {
      fees += config.specialCargo.hazmat;
    }
    if (cargoType.includes('oversized') || specialRequirements.includes('oversized')) {
      fees += config.specialCargo.oversized;
    }
    
    return fees;
  }
  
  /**
   * Apply peak season multiplier
   */
  applyPeakSeasonMultiplier(baseFee, config) {
    if (!config.peakSeason.enabled) {
      return baseFee;
    }
    
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const { startMonth, endMonth, multiplier } = config.peakSeason;
    
    // Handle year-wrap (e.g., Nov-Jan)
    let inPeakSeason = false;
    if (startMonth > endMonth) {
      inPeakSeason = currentMonth >= startMonth || currentMonth <= endMonth;
    } else {
      inPeakSeason = currentMonth >= startMonth && currentMonth <= endMonth;
    }
    
    return inPeakSeason ? baseFee * multiplier : baseFee;
  }
  
  /**
   * Apply return load discount
   */
  applyReturnLoadDiscount(baseFee, bookingData, config) {
    if (bookingData.hasReturnLoad || bookingData.returnLoad?.confirmed) {
      return baseFee * (1 - config.returnLoadDiscount);
    }
    return baseFee;
  }
  
  /**
   * Calculate cross-border fees
   */
  calculateCrossBorderFees(bookingData, config) {
    if (!bookingData.isCrossBorder && !bookingData.crossBorder?.enabled) {
      return {
        baseSurcharge: 0,
        documentationFee: 0,
        insurancePremium: 0,
        total: 0
      };
    }
    
    const fees = {
      baseSurcharge: config.crossBorder.baseSurcharge,
      documentationFee: config.crossBorder.documentationFee,
      insurancePremium: config.crossBorder.insurancePremium,
      total: 0
    };
    
    fees.total = fees.baseSurcharge + fees.documentationFee + fees.insurancePremium;
    return fees;
  }
  
  /**
   * Calculate insurance premium
   */
  calculateInsurance(bookingData, config) {
    if (!bookingData.insurance?.required) {
      return 0;
    }
    
    const cargoValue = bookingData.cargoDetails?.value || 0;
    if (cargoValue === 0) {
      return 0;
    }
    
    let rate = config.insurance.baseRate;
    const cargoType = bookingData.cargoDetails?.type?.toLowerCase() || '';
    
    // Apply multipliers based on cargo type
    if (cargoType.includes('hazmat') || cargoType.includes('hazardous')) {
      rate *= config.insurance.hazmatMultiplier;
    } else if (cargoType.includes('livestock')) {
      rate *= config.insurance.livestockMultiplier;
    } else if (cargoType.includes('agricult')) {
      rate *= config.insurance.agricultureMultiplier;
    }
    
    // Cross-border uses different rate
    if (bookingData.isCrossBorder || bookingData.crossBorder?.enabled) {
      rate = config.insurance.crossBorderRate;
    }
    
    let premium = cargoValue * rate;
    
    // Apply minimum premium
    if (premium < config.insurance.minimumPremium) {
      premium = config.insurance.minimumPremium;
    }
    
    return premium;
  }
  
  /**
   * Normalize vehicle type names
   */
  normalizeVehicleType(type) {
    const normalized = type.toLowerCase().replace(/[_-\s]/g, '');
    
    const mapping = {
      'bakkie': 'bakkie',
      '3ton': '3ton',
      '3tonne': '3ton',
      'threetonn': '3ton',
      '7ton': '7ton',
      '7tonne': '7ton',
      'seventonn': '7ton',
      '10ton': '10ton',
      '10tonne': '10ton',
      'tentonn': '10ton',
      '20ton': '20ton',
      '20tonne': '20ton',
      'twentytonn': '20ton',
      'trucktractor': 'truck_tractor',
      'tractor': 'truck_tractor'
    };
    
    return mapping[normalized] || '7ton';
  }
  
  /**
   * Get list of applied discounts
   */
  getAppliedDiscounts(bookingData, config) {
    const discounts = [];
    
    // Volume discount
    if (bookingData.bookingType === 'multiple' && bookingData.vehicles?.length >= 3) {
      const count = bookingData.vehicles.length;
      let rate;
      if (count >= 10) rate = config.volumeDiscounts.tenPlus;
      else if (count >= 5) rate = config.volumeDiscounts.fiveToNine;
      else rate = config.volumeDiscounts.threeToFour;
      
      discounts.push({
        type: 'volume_discount',
        description: `${count} vehicles`,
        rate: rate,
        percentage: `${rate * 100}%`
      });
    }
    
    // Return load discount
    if (bookingData.hasReturnLoad || bookingData.returnLoad?.confirmed) {
      discounts.push({
        type: 'return_load',
        description: 'Return load confirmed',
        rate: config.returnLoadDiscount,
        percentage: `${config.returnLoadDiscount * 100}%`
      });
    }
    
    // Long distance discount
    const distance = bookingData.route?.distance || 0;
    if (distance > 1000) {
      const discount = 1 - config.distanceMultipliers.over1000km;
      discounts.push({
        type: 'long_distance',
        description: 'Over 1000km',
        rate: discount,
        percentage: `${discount * 100}%`
      });
    }
    
    return discounts;
  }
  
  /**
   * Get list of applied surcharges
   */
  getAppliedSurcharges(bookingData, config) {
    const surcharges = [];
    
    // Short distance surcharge
    const distance = bookingData.route?.distance || 0;
    if (distance < 50) {
      const surcharge = config.distanceMultipliers.under50km - 1;
      surcharges.push({
        type: 'short_distance',
        description: 'Under 50km',
        rate: surcharge,
        percentage: `${surcharge * 100}%`
      });
    }
    
    // Urgency surcharge
    const urgency = bookingData.urgency?.toLowerCase();
    if (urgency && config.urgency[urgency]) {
      surcharges.push({
        type: 'urgency',
        description: urgency.replace('_', ' '),
        rate: config.urgency[urgency],
        percentage: `${config.urgency[urgency] * 100}%`
      });
    }
    
    // Fuel surcharge
    if (config.fuelSurcharge.enabled) {
      surcharges.push({
        type: 'fuel',
        description: 'Fuel surcharge',
        rate: config.fuelSurcharge.rate,
        percentage: `${config.fuelSurcharge.rate * 100}%`
      });
    }
    
    // Peak season
    if (config.peakSeason.enabled) {
      const currentMonth = new Date().getMonth() + 1;
      const { startMonth, endMonth, multiplier } = config.peakSeason;
      
      let inPeakSeason = false;
      if (startMonth > endMonth) {
        inPeakSeason = currentMonth >= startMonth || currentMonth <= endMonth;
      } else {
        inPeakSeason = currentMonth >= startMonth && currentMonth <= endMonth;
      }
      
      if (inPeakSeason) {
        surcharges.push({
          type: 'peak_season',
          description: 'Peak season',
          rate: multiplier - 1,
          percentage: `${(multiplier - 1) * 100}%`
        });
      }
    }
    
    // Cross-border
    if (bookingData.isCrossBorder || bookingData.crossBorder?.enabled) {
      surcharges.push({
        type: 'cross_border',
        description: 'Cross-border fees',
        amount: config.crossBorder.baseSurcharge + 
                config.crossBorder.documentationFee + 
                config.crossBorder.insurancePremium
      });
    }
    
    return surcharges;
  }

  /**
 * Calculate platform commission from transporter earnings
 * This is the platform's cut from the transporter's fee
 */
 async calculateTransporterCommission(transporterEarnings, bookingData, config) {
   const monetizationFees = await monetizationService.calculateShipmentFees(transporterEarnings, transporterEarnings, {
     audience: bookingData.corporateAccount || bookingData.userType === 'corporate' ? 'corporate' : 'all',
     paymentMethod: bookingData.paymentMethod,
     accountTier: bookingData.transporter?.tier || 'all'
   });
   if (monetizationFees.rule) {
     return {
       commission: Math.min(transporterEarnings, monetizationFees.transporterCommission),
       rate: monetizationFees.transporterCommissionRate,
       description: monetizationFees.rule.name
     };
   }

   if (!config.transportCommission?.enabled) {
     return {
       commission: 0,
       rate: 0,
       description: 'No commission'
     };
   }

  let commissionRate = config.transportCommission.rate; // Default 15%
  
  // Adjust commission based on transporter tier or other factors
  if (bookingData.transporter?.tier === 'premium') {
    commissionRate -= 0.05; // 5% discount for premium transporters
  }
  
  // New transporters might have different rates
 {/*} if (bookingData.transporter?.isNew) {
    commissionRate -= 0.02; // 2% discount for new transporters
  }*/}

  let commission = transporterEarnings * commissionRate;
  
  // Apply minimum commission
  if (commission < config.transportCommission.minimumCommission) {
    commission = config.transportCommission.minimumCommission;
  }
  
  // Ensure commission doesn't exceed transporter earnings
  if (commission > transporterEarnings) {
    commission = transporterEarnings;
  }

  return {
    commission,
    rate: commissionRate,
    description: `Platform service fee`
  };
}
}

module.exports = new PricingService();
