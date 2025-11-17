import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

const CounterOfferScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [offerType, setOfferType] = useState('price');
  const [newPrice, setNewPrice] = useState(job?.earnings || 400);
  const [reason, setReason] = useState('');
  const [newTime, setNewTime] = useState('');

  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const jobData = job || {
    id: 'PT-2025-001234',
    route: { from: 'Harare', to: 'Bulawayo' },
    earnings: 400,
    pickup: { time: '6-12 PM' }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Make Counter Offer</Text>
          <Text style={styles.headerSubtitle}>Negotiate terms</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Original Offer */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Original Offer</Text>
            <View style={styles.detailsList}>
              <DetailRow label="Route" value={`${jobData.route.from} → ${jobData.route.to}`} />
              <DetailRow label="Payment" value={`$${jobData.earnings}`} />
              <DetailRow label="Pickup Time" value={jobData.pickup.time} />
            </View>
          </View>
        </View>

        {/* Offer Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What would you like to change?</Text>
          <View style={styles.offerTypeGrid}>
            <TouchableOpacity
              style={[
                styles.offerTypeButton,
                offerType === 'price' && styles.offerTypeButtonActive
              ]}
              onPress={() => setOfferType('price')}
            >
              <MaterialIcons 
                name="attach-money" 
                size={24} 
                color={offerType === 'price' ? '#0C2D48' : '#6b7280'} 
              />
              <Text style={[
                styles.offerTypeText,
                offerType === 'price' && styles.offerTypeTextActive
              ]}>
                Price
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.offerTypeButton,
                offerType === 'time' && styles.offerTypeButtonActive
              ]}
              onPress={() => setOfferType('time')}
            >
              <MaterialIcons 
                name="access-time" 
                size={24} 
                color={offerType === 'time' ? '#0C2D48' : '#6b7280'} 
              />
              <Text style={[
                styles.offerTypeText,
                offerType === 'time' && styles.offerTypeTextActive
              ]}>
                Pickup Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Counter Offer Input */}
        {offerType === 'price' && (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Your Price (USD)</Text>
            <TextInput
              style={styles.textInput}
              value={String(newPrice)}
              onChangeText={setNewPrice}
              keyboardType="numeric"
              placeholder="Enter your price"
            />
            <Text style={styles.inputHelper}>
              Original: ${jobData.earnings}
            </Text>
          </View>
        )}

        {offerType === 'time' && (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Preferred Pickup Time</Text>
            <TextInput
              style={styles.textInput}
              value={newTime}
              onChangeText={setNewTime}
              placeholder="Enter preferred time"
            />
            <Text style={styles.inputHelper}>
              Original: {jobData.pickup.time}
            </Text>
          </View>
        )}

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.inputLabel}>Reason for Counter Offer</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain why you're making this counter offer..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Info */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={20} color="#92400e" />
            <Text style={styles.infoText}>
              The shipper will review your counter offer and can accept, decline, or negotiate further. You'll be notified within 24 hours.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitButton, !reason && styles.submitButtonDisabled]}
            onPress={() => navigateTo('CounterOfferSubmitted')}
            disabled={!reason}
          >
            <Text style={styles.submitButtonText}>Submit Counter Offer</Text>
          </TouchableOpacity>
        </View>

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper Components
const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailsList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  offerTypeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  offerTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: 'white',
  },
  offerTypeButtonActive: {
    borderColor: '#0C2D48',
    backgroundColor: '#dbeafe',
  },
  offerTypeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 8,
  },
  offerTypeTextActive: {
    color: '#0C2D48',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputHelper: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});

export default CounterOfferScreen;