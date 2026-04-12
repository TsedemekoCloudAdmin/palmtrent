// components/PricingBreakdown.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PricingBreakdown = ({ pricing, onToggleDetails }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  
  if (!pricing) return null;
  
  const { breakdown, totals, discountsApplied, surchargesApplied } = pricing;
  
  const handleToggle = () => {
    setShowDetails(!showDetails);
    if (onToggleDetails) {
      onToggleDetails(!showDetails);
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Price Estimate</Text>
          <Text style={styles.totalAmount}>USD ${totals.total}</Text>
        </View>
        <MaterialIcons 
          name={showDetails ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
          size={24} 
          color="#0C2D48" 
        />
      </TouchableOpacity>
      
      {/* Details */}
      {showDetails && (
        <View style={styles.details}>
          {/* Base Transport Fee */}
          <View style={styles.row}>
            <Text style={styles.label}>Base Transport Fee</Text>
            <Text style={styles.value}>USD ${breakdown.baseTransportFee}</Text>
          </View>
          
          {/* Special Cargo Fee */}
          {breakdown.specialCargoFee > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Special Cargo Handling</Text>
              <Text style={styles.value}>USD ${breakdown.specialCargoFee}</Text>
            </View>
          )}
          
          {/* Cross-Border Fees */}
          {breakdown.crossBorderFees?.total > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Cross-Border Fees</Text>
              <View style={styles.row}>
                <Text style={styles.sublabel}>Border Surcharge</Text>
                <Text style={styles.value}>USD ${breakdown.crossBorderFees.baseSurcharge}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.sublabel}>Documentation</Text>
                <Text style={styles.value}>USD ${breakdown.crossBorderFees.documentationFee}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.sublabel}>Insurance Premium</Text>
                <Text style={styles.value}>USD ${breakdown.crossBorderFees.insurancePremium}</Text>
              </View>
            </>
          )}
          
          {/* Discounts */}
          {discountsApplied?.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Discounts Applied</Text>
              {discountsApplied.map((discount, index) => (
                <View key={index} style={styles.row}>
                  <View style={styles.discountLabel}>
                    <MaterialIcons name="local-offer" size={16} color="#16a34a" />
                    <Text style={styles.discountText}>{discount.description}</Text>
                  </View>
                  <Text style={styles.discountValue}>-{discount.percentage}</Text>
                </View>
              ))}
            </>
          )}
          
          {/* Surcharges */}
          {surchargesApplied?.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Additional Charges</Text>
              {surchargesApplied.map((surcharge, index) => (
                <View key={index} style={styles.row}>
                  <Text style={styles.sublabel}>{surcharge.description}</Text>
                  <Text style={styles.value}>
                    {surcharge.percentage ? `+${surcharge.percentage}` : `+USD $${surcharge.amount}`}
                  </Text>
                </View>
              ))}
            </>
          )}
          
          {/* Platform Fee */}
          <View style={styles.divider} />
          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Platform Fee</Text>
              <Text style={styles.helperText}>
                {(breakdown.platformFeeRate * 100).toFixed(1)}% · {breakdown.paymentMethod}
              </Text>
            </View>
            <Text style={styles.value}>USD ${breakdown.platformFee}</Text>
          </View>
          
          {/* Insurance */}
          {breakdown.insurance > 0 && (
            <View style={styles.row}>
              <View>
                <Text style={styles.label}>Cargo Insurance</Text>
                <Text style={styles.helperText}>
                  {(breakdown.insuranceRate * 100).toFixed(2)}% coverage
                </Text>
              </View>
              <Text style={styles.value}>USD ${breakdown.insurance}</Text>
            </View>
          )}
          
          {/* Subtotal */}
          <View style={[styles.divider, styles.thickDivider]} />
          <View style={styles.row}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>USD ${totals.subtotal}</Text>
          </View>
          
          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>USD ${totals.total}</Text>
          </View>
          
          {/* Info */}
          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              All fees are configurable by admin. Final price confirmed at booking.
            </Text>
          </View>
        </View>
      )}
      
      {/* Quick Summary */}
      {!showDetails && (
        <View style={styles.quickSummary}>
          <View style={styles.quickRow}>
            <Text style={styles.quickLabel}>Transport</Text>
            <Text style={styles.quickValue}>USD ${breakdown.baseTransportFee}</Text>
          </View>
          <View style={styles.quickRow}>
            <Text style={styles.quickLabel}>Platform Fee</Text>
            <Text style={styles.quickValue}>USD ${breakdown.platformFee}</Text>
          </View>
          {breakdown.insurance > 0 && (
            <View style={styles.quickRow}>
              <Text style={styles.quickLabel}>Insurance</Text>
              <Text style={styles.quickValue}>USD ${breakdown.insurance}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  details: {
    padding: 16,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  sublabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  thickDivider: {
    height: 2,
    backgroundColor: '#d1d5db',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C2D48',
    marginBottom: 8,
  },
  discountLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  subtotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f0f9ff',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  quickSummary: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  quickValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});

export default PricingBreakdown;