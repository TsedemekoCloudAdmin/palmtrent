// screens/BookingReviewScreen.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Vehicle types for display
const vehicleTypes = [
  { value: 'bakkie', label: 'Bakkie (1-2 tonnes)' },
  { value: '3ton', label: '3-Tonne Truck' },
  { value: '5ton', label: '5-Tonne Truck' },
  { value: '7ton', label: '7-Tonne Truck' },
  { value: '10ton', label: '10-Tonne Truck' },
  { value: 'trailer', label: 'Truck Tractor with Trailer' }
];

const BookingReviewScreen = ({ onNavigate, bookingData = {}, updateBookingData }) => {
  // Calculate pricing based on booking type and details
const calculatePricing = () => {
  console.log('Booking Data:', bookingData);
  
  let basePrice = bookingData.bookingType === 'multiple' 
    ? (bookingData.vehicles || []).reduce((total, vehicle) => total + 400, 0)
    : 400;
  
  // Add cross-border surcharge
  if (bookingData.isCrossBorder) {
    basePrice += 130; // $50 surcharge + $50 insurance + $30 documentation
  }
  
  const platformFee = basePrice * 0.12;
  const insurance = bookingData.insurance ? basePrice * 0.01125 : 0;
  
  return {
    basePrice,
    platformFee,
    insurance,
    total: basePrice + platformFee + insurance
  };
};

  const pricing = calculatePricing();

  const handleConfirmBooking = () => {
    console.log('Confirming booking:', bookingData);
    onNavigate('booking-confirmation');
  };

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
              
              {bookingData.bookingType === 'multiple' && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Number of Vehicles</Text>
                    <Text style={styles.summaryValue}>{(bookingData.vehicles || []).length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Coordination</Text>
                    <Text style={styles.summaryValue}>
                      {bookingData.coordination === 'any' && 'Any Transporters'}
                      {bookingData.coordination === 'same_fleet' && 'Same Fleet Owner'}
                      {bookingData.coordination === 'coordinated' && 'Coordinated Pickup'}
                    </Text>
                  </View>
                </>
              )}
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
                  <Text style={styles.routeDetailValue}>440 km</Text>
                </View>
                <View style={styles.routeDetail}>
                  <Text style={styles.routeDetailLabel}>Est. Duration</Text>
                  <Text style={styles.routeDetailValue}>7-8 hours</Text>
                </View>
                <View style={styles.routeDetail}>
                  <Text style={styles.routeDetailLabel}>Pickup Time</Text>
                  <Text style={styles.routeDetailValue}>{bookingData.pickupDate || 'Not specified'}</Text>
                </View>
              </View>
            </View>
          </View>

          {bookingData.isCrossBorder && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Cross-Border Details</Text>
    <View style={styles.crossBorderCard}>
      <View style={styles.crossBorderRow}>
        <MaterialIcons name="flag" size={20} color="#7c3aed" />
        <View style={styles.crossBorderContent}>
          <Text style={styles.crossBorderLabel}>Destination Country</Text>
          <Text style={styles.crossBorderValue}>
            {bookingData.destinationCountry?.name || 'Not specified'}
          </Text>
        </View>
      </View>
      <View style={styles.crossBorderRow}>
        <MaterialIcons name="description" size={20} color="#7c3aed" />
        <View style={styles.crossBorderContent}>
          <Text style={styles.crossBorderLabel}>Border Post</Text>
          <Text style={styles.crossBorderValue}>
            {bookingData.destinationCountry?.border || 'Not specified'}
          </Text>
        </View>
      </View>
      {bookingData.requiredDocuments && (
        <View style={styles.documentsSection}>
          <Text style={styles.documentsTitle}>Required Documents:</Text>
          {Object.entries(bookingData.requiredDocuments).map(([doc, completed]) => (
            <View key={doc} style={styles.documentStatus}>
              <MaterialIcons 
                name={completed ? "check-circle" : "radio-button-unchecked"} 
                size={16} 
                color={completed ? "#059669" : "#6b7280"} 
              />
              <Text style={[
                styles.documentText,
                completed && styles.documentCompleted
              ]}>
                {doc.split(/(?=[A-Z])/).join(' ')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  </View>
)}

          {/* Cargo Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {bookingData.bookingType === 'multiple' ? 'Vehicles & Cargo' : 'Cargo Details'}
            </Text>
            
            {bookingData.bookingType === 'multiple' ? (
              <View style={styles.vehiclesList}>
                {(bookingData.vehicles || []).map((vehicle, index) => (
                  <View key={vehicle.id || index} style={styles.vehicleItem}>
                    <Text style={styles.vehicleNumber}>Vehicle {index + 1}</Text>
                    <View style={styles.vehicleDetails}>
                      <Text style={styles.vehicleDetail}>
                        Type: {vehicleTypes.find(t => t.value === vehicle.type)?.label || 'Not specified'}
                      </Text>
                      <Text style={styles.vehicleDetail}>
                        Weight: {vehicle.weight || 'Not specified'} kg
                      </Text>
                      <Text style={styles.vehicleDetail}>
                        Cargo: {vehicle.description || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.cargoCard}>
                <Text style={styles.cargoType}>{bookingData.cargoType || 'Not specified'}</Text>
                <View style={styles.cargoDetails}>
                  <Text style={styles.cargoDetail}>Weight: {bookingData.weight || 'Not specified'} kg</Text>
                  <Text style={styles.cargoDetail}>Value: ${bookingData.cargoValue || '0'}</Text>
                  {bookingData.specialInstructions && (
                    <Text style={styles.cargoDetail}>
                      Instructions: {bookingData.specialInstructions}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Insurance */}
          {bookingData.insurance && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insurance</Text>
              <View style={styles.insuranceCard}>
                <MaterialIcons name="verified" size={24} color="#059669" />
                <View style={styles.insuranceContent}>
                  <Text style={styles.insuranceTitle}>Cargo Protection Active</Text>
                  <Text style={styles.insuranceSubtitle}>
                    Full coverage up to ${bookingData.cargoValue || '0'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Price Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Breakdown</Text>
            <View style={styles.pricingCard}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Transport Fee</Text>
                <Text style={styles.pricingValue}>${pricing.basePrice}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Platform Fee (12%)</Text>
                <Text style={styles.pricingValue}>${pricing.platformFee.toFixed(2)}</Text>
              </View>
              {bookingData.insurance && (
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Insurance</Text>
                  <Text style={styles.pricingValue}>${pricing.insurance.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.pricingDivider} />
              <View style={styles.pricingRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>${pricing.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentCard}>
              <MaterialIcons name="payment" size={24} color="#0C2D48" />
              <View style={styles.paymentContent}>
                <Text style={styles.paymentMethod}>
                  {bookingData.paymentMethod === 'ecocash' && 'EcoCash / OneMoney'}
                  {bookingData.paymentMethod === 'cash_agent' && 'Cash via EcoCash Agent'}
                  {bookingData.paymentMethod === 'cash_pickup' && 'Cash on Pickup'}
                  {!bookingData.paymentMethod && 'Not selected'}
                </Text>
                <Text style={styles.paymentDescription}>
                  {bookingData.paymentMethod === 'ecocash' && 'Instant confirmation • 12% fee'}
                  {bookingData.paymentMethod === 'cash_agent' && 'Pay at any agent • 12% fee'}
                  {bookingData.paymentMethod === 'cash_pickup' && 'Driver collects • 15% fee'}
                </Text>
              </View>
            </View>
          </View>
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
          style={styles.confirmButton}
          onPress={handleConfirmBooking}
        >
          <Text style={styles.confirmButtonText}>Confirm Booking</Text>
          <MaterialIcons name="check" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  vehiclesList: {
    gap: 12,
  },
  vehicleItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  vehicleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  vehicleDetails: {
    gap: 4,
  },
  vehicleDetail: {
    fontSize: 14,
    color: '#374151',
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 2,
  },
  insuranceSubtitle: {
    fontSize: 14,
    color: '#374151',
  },
  pricingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  paymentContent: {
    flex: 1,
  },
  paymentMethod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  paymentDescription: {
    fontSize: 14,
    color: '#6b7280',
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
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  crossBorderCard: {
  backgroundColor: 'white',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#e5e7eb',
  padding: 16,
  gap: 12,
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
documentsSection: {
  marginTop: 8,
  paddingTop: 12,
  borderTopWidth: 1,
  borderTopColor: '#e5e7eb',
},
documentsTitle: {
  fontSize: 14,
  fontWeight: '500',
  color: '#374151',
  marginBottom: 8,
},
documentStatus: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
},
documentText: {
  fontSize: 14,
  color: '#6b7280',
},
documentCompleted: {
  color: '#059669',
  fontWeight: '500',
},
});

export default BookingReviewScreen;