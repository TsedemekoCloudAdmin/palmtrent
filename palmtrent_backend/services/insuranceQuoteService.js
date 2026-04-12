// services/insuranceQuoteService.js
const InsuranceProvider = require('../models/InsuranceProvider');

class InsuranceQuoteService {

  /**
   * Get quotes from all providers for a shipment
   */
  async getQuotes(cargoValue, cargoType, coverageType = 'standard') {
    try {
      // Ensure providers are seeded
      const providerCount = await InsuranceProvider.countDocuments();
      if (providerCount === 0) {
        await InsuranceProvider.seedProviders();
      }

      const quotes = await InsuranceProvider.getAllQuotes(cargoValue, cargoType, coverageType);

      return {
        success: true,
        data: {
          quotes,
          cargoValue,
          cargoType,
          coverageType,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      };
    } catch (error) {
      console.error('Error getting insurance quotes:', error);
      throw error;
    }
  }

  /**
   * Get quotes for all coverage types from a specific provider
   */
  async getProviderQuotes(providerCode, cargoValue, cargoType) {
    try {
      const provider = await InsuranceProvider.findOne({ code: providerCode, active: true });

      if (!provider) {
        throw new Error('Provider not found');
      }

      const quotes = [];
      const coverageTypes = ['basic', 'standard', 'comprehensive'];

      for (const coverageType of coverageTypes) {
        const quote = provider.getQuote(cargoValue, cargoType, coverageType);
        if (quote) {
          quotes.push(quote);
        }
      }

      return {
        success: true,
        data: {
          provider: {
            code: provider.code,
            name: provider.displayName,
            rating: provider.rating,
            contact: provider.contactInfo
          },
          quotes,
          cargoValue,
          cargoType
        }
      };
    } catch (error) {
      console.error('Error getting provider quotes:', error);
      throw error;
    }
  }

  /**
   * Compare quotes across providers for a specific coverage level
   */
  async compareQuotes(cargoValue, cargoType, coverageType = 'standard') {
    try {
      const result = await this.getQuotes(cargoValue, cargoType, coverageType);
      const quotes = result.data.quotes;

      if (quotes.length === 0) {
        return {
          success: true,
          data: {
            message: 'No quotes available for the specified criteria',
            quotes: []
          }
        };
      }

      // Sort by premium (lowest first)
      const sortedByPrice = [...quotes].sort((a, b) => a.premium - b.premium);

      // Sort by coverage (highest first)
      const sortedByCoverage = [...quotes].sort((a, b) => b.coverageAmount - a.coverageAmount);

      // Find best value (coverage per dollar)
      const withValue = quotes.map(q => ({
        ...q,
        valueRatio: q.coverageAmount / q.premium
      }));
      const sortedByValue = withValue.sort((a, b) => b.valueRatio - a.valueRatio);

      return {
        success: true,
        data: {
          comparison: {
            lowestPremium: sortedByPrice[0],
            highestCoverage: sortedByCoverage[0],
            bestValue: sortedByValue[0],
            highestRated: quotes.reduce((max, q) => q.rating > max.rating ? q : max, quotes[0])
          },
          allQuotes: quotes,
          cargoValue,
          cargoType,
          coverageType
        }
      };
    } catch (error) {
      console.error('Error comparing quotes:', error);
      throw error;
    }
  }

  /**
   * Get recommended quote based on cargo details
   */
  async getRecommendedQuote(bookingData) {
    try {
      const cargoValue = bookingData.cargoDetails?.value || 0;
      const cargoType = this.mapCargoType(bookingData.cargoDetails?.type);
      const isCrossBorder = bookingData.isCrossBorder || bookingData.crossBorder?.enabled;

      // Determine recommended coverage level
      let recommendedCoverage = 'standard';

      if (cargoValue > 10000) {
        recommendedCoverage = 'comprehensive';
      } else if (cargoValue < 1000) {
        recommendedCoverage = 'basic';
      }

      // For cross-border, always recommend comprehensive
      if (isCrossBorder) {
        recommendedCoverage = 'comprehensive';
      }

      // For fragile or perishable, recommend higher coverage
      if (['fragile', 'perishable', 'electronics'].includes(cargoType)) {
        recommendedCoverage = 'comprehensive';
      }

      const quotes = await this.getQuotes(cargoValue, cargoType, recommendedCoverage);

      if (quotes.data.quotes.length === 0) {
        // Fallback to standard if no quotes for recommended level
        const fallbackQuotes = await this.getQuotes(cargoValue, cargoType, 'standard');
        return {
          success: true,
          data: {
            recommended: fallbackQuotes.data.quotes[0],
            alternatives: fallbackQuotes.data.quotes.slice(1, 3),
            recommendedCoverage: 'standard',
            reason: 'Based on cargo type and value'
          }
        };
      }

      // Get highest rated quote as recommendation
      const sorted = quotes.data.quotes.sort((a, b) => b.rating - a.rating);

      return {
        success: true,
        data: {
          recommended: sorted[0],
          alternatives: sorted.slice(1, 3),
          recommendedCoverage,
          reason: this.getRecommendationReason(cargoValue, cargoType, isCrossBorder)
        }
      };
    } catch (error) {
      console.error('Error getting recommended quote:', error);
      throw error;
    }
  }

  /**
   * Map cargo type string to insurance category
   */
  mapCargoType(cargoTypeStr) {
    if (!cargoTypeStr) return 'general';

    const normalized = cargoTypeStr.toLowerCase();

    if (normalized.includes('fragile') || normalized.includes('glass')) return 'fragile';
    if (normalized.includes('perishable') || normalized.includes('food')) return 'perishable';
    if (normalized.includes('hazard') || normalized.includes('chemical')) return 'hazmat';
    if (normalized.includes('livestock') || normalized.includes('animal')) return 'livestock';
    if (normalized.includes('vehicle') || normalized.includes('car')) return 'vehicles';
    if (normalized.includes('machine') || normalized.includes('equipment')) return 'machinery';
    if (normalized.includes('agricult') || normalized.includes('farm')) return 'agricultural';
    if (normalized.includes('electronic') || normalized.includes('computer')) return 'electronics';

    return 'general';
  }

  /**
   * Get recommendation reason text
   */
  getRecommendationReason(cargoValue, cargoType, isCrossBorder) {
    const reasons = [];

    if (cargoValue > 10000) {
      reasons.push('High cargo value requires comprehensive protection');
    }

    if (['fragile', 'perishable', 'electronics'].includes(cargoType)) {
      reasons.push(`${cargoType} cargo needs specialized coverage`);
    }

    if (isCrossBorder) {
      reasons.push('Cross-border shipments benefit from full coverage');
    }

    if (reasons.length === 0) {
      reasons.push('Standard coverage provides good value for your shipment');
    }

    return reasons.join('. ');
  }

  /**
   * Get all active providers
   */
  async getProviders() {
    try {
      const providers = await InsuranceProvider.getActiveProviders();

      return {
        success: true,
        data: providers.map(p => ({
          code: p.code,
          name: p.displayName,
          description: p.description,
          rating: p.rating,
          products: p.products.filter(pr => pr.active).map(pr => ({
            code: pr.productCode,
            name: pr.productName,
            coverageType: pr.coverageType,
            coveragePercentage: pr.coveragePercentage
          })),
          contact: p.contactInfo
        }))
      };
    } catch (error) {
      console.error('Error getting providers:', error);
      throw error;
    }
  }

  /**
   * Validate and select a quote for booking
   */
  async selectQuote(quoteData, bookingId) {
    try {
      const { providerCode, productCode, cargoValue, coverageType } = quoteData;

      const provider = await InsuranceProvider.findOne({ code: providerCode, active: true });

      if (!provider) {
        throw new Error('Selected provider not found');
      }

      const product = provider.products.find(p => p.productCode === productCode && p.active);

      if (!product) {
        throw new Error('Selected product not found');
      }

      // Recalculate premium to ensure it's current
      let premium = cargoValue * product.premiumRate;
      if (product.minPremium && premium < product.minPremium) {
        premium = product.minPremium;
      }

      const coverageAmount = cargoValue * (product.coveragePercentage / 100);

      return {
        success: true,
        data: {
          provider: {
            code: provider.code,
            name: provider.displayName
          },
          product: {
            code: product.productCode,
            name: product.productName
          },
          coverageType: product.coverageType,
          coveragePercentage: product.coveragePercentage,
          coverageAmount: Math.round(coverageAmount * 100) / 100,
          premium: Math.round(premium * 100) / 100,
          excess: product.excessAmount || 0,
          cargoValue,
          selectedAt: new Date(),
          bookingId
        }
      };
    } catch (error) {
      console.error('Error selecting quote:', error);
      throw error;
    }
  }
}

module.exports = new InsuranceQuoteService();
