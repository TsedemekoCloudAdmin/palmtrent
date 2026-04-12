import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import PricingBreakdown from '../screens/components/PricingBreakdown';
import apiService from '../services/apiService';

const paymentMethods = [
  {
    id: 'ecocash',
    name: "EcoCash",
    description: "Instant confirmation • 12% fee",
    recommended: true,
    requiresGateway: true
  },
  {
    id: 'cash_agent',
    name: "Cash via EcoCash Agent",
    description: "Pay at any agent • 12% fee",
    recommended: false,
    requiresGateway: false
  },
  {
    id: 'bank_transfer',
    name: "Pay via Card/EFT",
    description: "Pay using your bank • 12% fee",
    recommended: false,
    requiresGateway: true
  },
  {
    id: 'cash_on_pickup',
    name: "Cash on Pickup",
    description: "Driver collects • 15% fee",
    recommended: false,
    requiresGateway: false
  },
  {
    id: 'cash_on_delivery',
    name: "Cash on Delivery",
    description: "Recipient pays • 18% fee (Higher risk)",
    recommended: false,
    requiresGateway: false
  }
];

const BookingReviewScreen = ({ onNavigate, bookingData = {}, updateBookingData }) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(bookingData.paymentMethod || null);
  const [insuranceEnabled, setInsuranceEnabled] = useState(bookingData.insurance || false);
  const [pricing, setPricing] = useState(bookingData.pricing || null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  // Calculate pricing whenever payment method or insurance changes
  useEffect(() => {
    if (selectedPaymentMethod) {
      calculatePricing();
    }
  }, [selectedPaymentMethod, insuranceEnabled]);

  const calculatePricing = async () => {
    setLoadingPricing(true);
    
    try {
      const pricingData = {
        route: {
          distance: bookingData.routeInfo?.distance || 0,
          pickup: { address: bookingData.pickupLocation },
          delivery: { address: bookingData.deliveryLocation }
        },
        cargoDetails: {
          type: bookingData.cargoType,
          weight: parseFloat(bookingData.weight) || 0,
          value: parseFloat(bookingData.cargoValue) || 0,
          specialRequirements: bookingData.specialInstructions ? [bookingData.specialInstructions] : []
        },
        insurance: {
          required: insuranceEnabled
        },
        paymentMethod: selectedPaymentMethod,
        bookingType: bookingData.bookingType || 'single',
        isCrossBorder: bookingData.isCrossBorder || false,
        urgency: 'standard'
      };
      
      const response = await apiService.post('/bookings/calculate-pricing', pricingData);
      
      if (response.success) {
        setPricing(response.data);
      }
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
      // Use existing pricing as fallback
      if (bookingData.pricing) {
        setPricing(bookingData.pricing);
      }
    } finally {
      setLoadingPricing(false);
    }
  };

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  const handleInsuranceToggle = (value) => {
    setInsuranceEnabled(value);
  };

  // UPDATED: Handle booking confirmation with proper payment flow
const handleConfirmBooking = async () => {
  if (!selectedPaymentMethod) {
    Alert.alert('Payment Method Required', 'Please select a payment method to continue.');
    return;
  }

  setCreatingBooking(true);
  
  try {
    // Prepare booking data
    const completeBookingData = {
      // ... your existing booking data
      bookingType: bookingData.bookingType || 'single',
      cargoType: bookingData.cargoType,
      weight: parseFloat(bookingData.weight) || 0,
      cargoValue: parseFloat(bookingData.cargoValue) || 0,
      specialInstructions: bookingData.specialInstructions || '',
      images: bookingData.images || [],
      pickupLocation: bookingData.pickupLocation,
      deliveryLocation: bookingData.deliveryLocation,
      pickupDate: bookingData.pickupDate,
      insurance: insuranceEnabled,
      isCrossBorder: bookingData.isCrossBorder || false,
      paymentMethod: selectedPaymentMethod,
      routeInfo: bookingData.routeInfo,
      vehicleRecommendation: bookingData.vehicleRecommendation,
      pricing: pricing
    };
    
    // Create booking with payment in one call
    const createResponse = await apiService.post('/bookings/create-with-payment', {
      ...completeBookingData,
      amount: pricing?.totals?.total || 0,
      customer: {
        email: 'user@example.com' // Get from user context
      }
    });
    
    if (!createResponse.success) {
      throw new Error(createResponse.message || 'Failed to create booking');
    }

    const { booking, payment } = createResponse.data;
    console.log("Booking and payment created:", { booking, payment });

    // Update booking data
    updateBookingData({
      ...bookingData,
      paymentMethod: selectedPaymentMethod,
      insurance: insuranceEnabled,
      pricing: pricing,
      bookingReference: booking.bookingReference,
      bookingId: booking._id,
      paymentReference: payment?.paymentReference,
      amount: pricing?.totals?.total || 0
    });

    // Determine next steps based on payment method
    const selectedMethod = paymentMethods.find(method => method.id === selectedPaymentMethod);
    
    if (selectedMethod.requiresGateway) {
      // For gateway payments, navigate to payment screen
      onNavigate('card-payment', {
        paymentReference: payment.paymentReference,
        amount: pricing?.totals?.total || 0,
        paymentMethod: selectedPaymentMethod
      });
    } else {
      // For cash methods, payment is already pending - go to confirmation
      onNavigate('booking-confirmation', {
        bookingId: booking._id,
        paymentReference: payment.paymentReference,
        paymentMethod: selectedPaymentMethod
      });
    }
    
  } catch (error) {
    console.error('Error creating booking:', error);
    Alert.alert('Error', error.message || 'Failed to create booking. Please try again.');
  } finally {
    setCreatingBooking(false);
  }
};
  const isValid = selectedPaymentMethod !== null && pricing !== null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => onNavigate('create-booking')} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Review Booking</Text>
          <Text style={styles.headerSubtitle}>Confirm your shipment details</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Booking Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Booking Type</Text>
                <Text style={styles.summaryValue}>
                  {bookingData.bookingType === 'multiple' ? 'Multiple Vehicles' : 'Single Vehicle'}
                </Text>
              </View>
              
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Vehicle</Text>
                <Text style={styles.summaryValue}>
                  {bookingData.vehicleRecommendation?.displayName || 'Not specified'}
                </Text>
              </View>
            </View>
          </View>

          {/* Route Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route Details</Text>
            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <MaterialIcons name="location-on" size={20} color="#ef4444" />
                <View style={styles.routeText}>
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeValue}>{bookingData.pickupLocation || 'Not specified'}</Text>
                </View>
              </View>
              
              <View style={styles.routeLine} />
              
              <View style={styles.routeRow}>
                <MaterialIcons name="location-on" size={20} color="#059669" />
                <View style={styles.routeText}>
                  <Text style={styles.routeLabel}>Delivery</Text>
                  <Text style={styles.routeValue}>{bookingData.deliveryLocation || 'Not specified'}</Text>
                </View>
              </View>
              
              <View style={styles.routeInfo}>
                <View style={styles.routeDetail}>
                  <Text style={styles.routeDetailLabel}>Distance</Text>
                  <Text style={styles.routeDetailValue}>{bookingData.routeInfo?.distance || 0} km</Text>
                </View>
                <View style={styles.routeDetail}>
                  <Text style={styles.routeDetailLabel}>Est. Duration</Text>
                  <Text style={styles.routeDetailValue}>{bookingData.routeInfo?.duration || 'Not specified'}</Text>
                </View>
                <View style={styles.routeDetail}>
                  <Text style={styles.routeDetailLabel}>Pickup Time</Text>
                  <Text style={styles.routeDetailValue}>{bookingData.pickupDate || 'Not specified'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Cross-Border Details */}
          {bookingData.isCrossBorder && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cross-Border Details</Text>
              <View style={styles.crossBorderCard}>
                <View style={styles.crossBorderRow}>
                  <MaterialIcons name="flag" size={20} color="#7c3aed" />
                  <View style={styles.crossBorderContent}>
                    <Text style={styles.crossBorderLabel}>International Shipment</Text>
                    <Text style={styles.crossBorderValue}>
                      Additional documentation required
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Cargo Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cargo Details</Text>
            <View style={styles.cargoCard}>
              <Text style={styles.cargoType}>{bookingData.cargoType || 'Not specified'}</Text>
              <View style={styles.cargoDetails}>
                <Text style={styles.cargoDetail}>Weight: {bookingData.weight || '0'} kg</Text>
                <Text style={styles.cargoDetail}>Value: USD ${bookingData.cargoValue || '0'}</Text>
                {bookingData.specialInstructions && (
                  <Text style={styles.cargoDetail}>
                    Instructions: {bookingData.specialInstructions}
                  </Text>
                )}
                {bookingData.images && bookingData.images.length > 0 && (
                  <Text style={styles.cargoDetail}>
                    Photos: {bookingData.images.length} attached
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Insurance Option */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insurance</Text>
            <View style={styles.insuranceCard}>
              <Switch
                value={insuranceEnabled}
                onValueChange={handleInsuranceToggle}
                trackColor={{ false: '#767577', true: '#0C2D48' }}
                thumbColor={insuranceEnabled ? '#f5dd4b' : '#f4f3f4'}
              />
              <View style={styles.insuranceContent}>
                <View style={styles.insuranceTitleRow}>
                  <MaterialIcons name="security" size={20} color="#0C2D48" />
                  <Text style={styles.insuranceTitle}>Protect Your Cargo</Text>
                </View>
                <Text style={styles.insuranceDescription}>
                  Full replacement coverage if damaged, lost, or stolen
                </Text>
                <View style={styles.insuranceDetails}>
                  <Text style={styles.insuranceDetail}>
                    <Text style={styles.detailLabel}>Coverage:</Text> USD ${bookingData.cargoValue || '0'}
                  </Text>
                  <Text style={styles.insuranceDetail}>
                    <Text style={styles.detailLabel}>Premium:</Text> ~0.45% of cargo value
                  </Text>
                  <Text style={styles.insuranceProvider}>Provider: Zimnat Lion Insurance</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Payment Method Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method *</Text>
            <View style={styles.paymentOptions}>
              {paymentMethods.map((method) => (
                <PaymentOption
                  key={method.id}
                  name={method.name}
                  description={method.description}
                  recommended={method.recommended}
                  isSelected={selectedPaymentMethod === method.id}
                  onPress={() => handlePaymentMethodSelect(method.id)}
                />
              ))}
            </View>
          </View>

          {/* Price Breakdown */}
          {selectedPaymentMethod && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price Breakdown</Text>
              {loadingPricing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0C2D48" />
                  <Text style={styles.loadingText}>Calculating final price...</Text>
                </View>
              ) : pricing ? (
                <PricingBreakdown 
                  pricing={pricing}
                  onToggleDetails={(expanded) => {
                    console.log('Pricing details', expanded ? 'expanded' : 'collapsed');
                  }}
                />
              ) : null}
            </View>
          )}

          {/* Notice */}
          {!selectedPaymentMethod && (
            <View style={styles.noticeCard}>
              <MaterialIcons name="info-outline" size={24} color="#0C2D48" />
              <Text style={styles.noticeText}>
                Please select a payment method to see the final price
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.backButtonBottom}
          onPress={() => onNavigate('create-booking')}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, (!isValid || creatingBooking) && styles.confirmButtonDisabled]}
          onPress={handleConfirmBooking}
          disabled={!isValid || creatingBooking}
        >
          {creatingBooking ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>Confirm Booking</Text>
              <MaterialIcons name="check" size={20} color="white" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// PaymentOption component with gateway indicator
const PaymentOption = ({ name, description, recommended, isSelected, onPress }) => {
  const selectedMethod = paymentMethods.find(method => method.name === name);
  const requiresGateway = selectedMethod?.requiresGateway;

  return (
    <TouchableOpacity 
      style={[
        styles.paymentOption,
        isSelected && styles.paymentOptionSelected
      ]} 
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.radioContainer}>
        <View style={[
          styles.radioOuter,
          isSelected && styles.radioOuterSelected
        ]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </View>
      <View style={styles.paymentInfo}>
        <View style={styles.paymentHeader}>
          <Text style={[
            styles.paymentName,
            isSelected && styles.paymentNameSelected
          ]}>{name}</Text>
          <View style={styles.paymentBadges}>
            {recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
            {requiresGateway && (
              <View style={styles.gatewayBadge}>
                <Text style={styles.gatewayText}>Secure Payment</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.paymentDescription}>{description}</Text>
        {requiresGateway && (
          <Text style={styles.gatewayNote}>
            You'll be redirected to secure payment page
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 16,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  routeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeText: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 9,
    marginVertical: 4,
  },
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  routeDetail: {
    alignItems: 'center',
  },
  routeDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  routeDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  crossBorderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  crossBorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crossBorderContent: {
    flex: 1,
  },
  crossBorderLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  crossBorderValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  cargoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cargoType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  cargoDetails: {
    gap: 4,
  },
  cargoDetail: {
    fontSize: 14,
    color: '#374151',
  },
  insuranceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  insuranceDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  insuranceDetails: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    padding: 12,
  },
  insuranceDetail: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#1e40af',
  },
  insuranceProvider: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  paymentOptions: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  paymentOptionSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  radioContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#0C2D48',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0C2D48',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  paymentNameSelected: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  paymentBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  recommendedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  gatewayBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  gatewayText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  paymentDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  gatewayNote: {
    fontSize: 12,
    color: '#4b5563',
    fontStyle: 'italic',
    marginTop: 2,
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  backButtonBottom: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    paddingVertical: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default BookingReviewScreen;