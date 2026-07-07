// screens/BookingStartScreen.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const BookingStartScreen = ({ onNavigate, bookingData, updateBookingData }) => {
  const options = [
    {
      id: 'single',
      icon: 'local-shipping',
      title: 'Single Vehicle',
      description: 'One vehicle for your cargo',
      bestFor: 'Most shipments, simple deliveries',
      features: ['Quick matching', 'Simple process', 'Flexible options']
    },
    {
      id: 'multiple',
      icon: 'airport-shuttle',
      title: 'Multiple Vehicles',
      description: '2 or more vehicles needed',
      bestFor: 'Large cargo, split shipments',
      features: ['Coordinated pickup', 'Volume discount (10%)', 'Single point of contact'],
      badge: 'Save 10%'
    },
    {
      id: 'recurring',
      icon: 'event-repeat',
      title: 'Recurring Shipment',
      description: 'Regular scheduled deliveries',
      bestFor: 'Weekly/monthly shipments',
      features: ['Set schedule', 'Best rates', 'Priority matching'],
      badge: 'Best Rates'
    }
  ];

  const handleSelect = (optionId) => {
    updateBookingData({ bookingType: optionId });
    
    switch (optionId) {
      case 'single':
        onNavigate('create-booking');
        break;
      case 'multiple':
        onNavigate('multiple-vehicles');
        break;
      case 'recurring':
        // For now, navigate to create booking with recurring flag
        updateBookingData({ isRecurring: true });
        onNavigate('create-booking');
        break;
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book Transport</Text>
        <Text style={styles.headerSubtitle}>How many vehicles do you need?</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <MaterialIcons name="info" size={20} color="#1e40af" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Not sure?</Text>
              <Text style={styles.infoText}>
                Single vehicle handles most shipments up to 10 tonnes. Need more? Select multiple vehicles.
              </Text>
            </View>
          </View>

          {/* Booking Options */}
          <View style={styles.optionsContainer}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  bookingData.bookingType === option.id && styles.optionCardSelected
                ]}
                onPress={() => handleSelect(option.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionHeader}>
                  <View style={[
                    styles.iconContainer,
                    bookingData.bookingType === option.id && styles.iconContainerSelected
                  ]}>
                    <MaterialIcons 
                      name={option.icon} 
                      size={32} 
                      color={bookingData.bookingType === option.id ? '#059669' : '#6b7280'} 
                    />
                  </View>
                  
                  <View style={styles.optionText}>
                    <View style={styles.titleRow}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      {option.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{option.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>

                  <View style={[
                    styles.radioOuter,
                    bookingData.bookingType === option.id && styles.radioOuterSelected
                  ]}>
                    {bookingData.bookingType === option.id && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>

                <View style={styles.optionDetails}>
                  <Text style={styles.bestForLabel}>BEST FOR:</Text>
                  <Text style={styles.bestForText}>{option.bestFor}</Text>
                  
                  <View style={styles.featuresContainer}>
                    {option.features.map((feature, idx) => (
                      <View key={idx} style={styles.featureTag}>
                        <Text style={styles.featureText}>✓ {feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
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
    padding: 24,
    paddingTop: 40,    
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
  },
  optionCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  iconContainer: {
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  iconContainerSelected: {
    backgroundColor: '#dcfce7',
  },
  optionText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  badge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#059669',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  optionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
  bestForLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bestForText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 12,
    color: '#374151',
  },
});

export default BookingStartScreen;