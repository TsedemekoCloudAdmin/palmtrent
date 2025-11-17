// screens/BookingConfirmationScreen.js
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

const BookingConfirmationScreen = ({ onNavigate, bookingData, onExit }) => {
    const handleBackToHome = () => {
    if (onExit) {
      onExit(); // This will trigger navigation back to Home
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={80} color="#F37021" />
          </View>

          {/* Success Message */}
          <View style={styles.successMessage}>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your shipment has been scheduled and transporters are being matched
            </Text>
          </View>

          {/* Booking Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Booking Details</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking ID</Text>
              <Text style={styles.detailValue}>TRK-{Date.now().toString().slice(-6)}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Route</Text>
              <Text style={styles.detailValue}>
                {bookingData.pickupLocation} → {bookingData.deliveryLocation}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Time</Text>
              <Text style={styles.detailValue}>{bookingData.pickupDate}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Matching Transporters</Text>
              </View>
            </View>
          </View>

          {/* Next Steps */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>What happens next?</Text>
            
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Transporter Matching</Text>
                <Text style={styles.stepDescription}>
                  We're finding the best transporters for your route. You'll get matches within 15 minutes.
                </Text>
              </View>
            </View>
            
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Confirm Match</Text>
                <Text style={styles.stepDescription}>
                  Review and accept a transporter. You'll see their ratings, vehicle details, and price.
                </Text>
              </View>
            </View>
            
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Track Shipment</Text>
                <Text style={styles.stepDescription}>
                  Monitor your shipment in real-time and receive updates at every stage.
                </Text>
              </View>
            </View>
          </View>

          {/* Support Info */}
          <View style={styles.supportCard}>
            <MaterialIcons name="support-agent" size={24} color="#0C2D48" />
            <View style={styles.supportContent}>
              <Text style={styles.supportTitle}>Need help?</Text>
              <Text style={styles.supportText}>
                Contact our support team at +263 77 123 4567 or support@transport.com
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.trackButton}
          onPress={handleBackToHome}
        >
          <MaterialIcons name="gps-fixed" size={20} color="white" />
          <Text style={styles.trackButtonText}>Go to Home</Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    gap: 24,
  },
  successIcon: {
    marginTop: 40,
    marginBottom: 16,
  },
  successMessage: {
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0C2D48',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    gap: 12,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  stepsCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    gap: 20,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  supportText: {
    fontSize: 14,
    color: '#374151',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  trackButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    paddingVertical: 16,
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  newBookingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
  },
  newBookingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
});

export default BookingConfirmationScreen;