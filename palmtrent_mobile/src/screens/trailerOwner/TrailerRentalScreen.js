import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const TrailerRentalScreen = ({ navigation }) => {
  const [selectedTrailer, setSelectedTrailer] = useState(null);

  const availableTrailers = [
    {
      id: 1,
      type: 'Flatbed',
      capacity: '10 tonnes',
      owner: "Mike's Trailers",
      location: 'Msasa (15km away)',
      rate: 80,
      rating: 4.9,
      condition: 'Excellent'
    },
    {
      id: 2,
      type: 'Flatbed',
      capacity: '12 tonnes',
      owner: 'Zim Trailers Ltd',
      location: 'Southerton (8km away)',
      rate: 100,
      rating: 4.6,
      condition: 'Good'
    },
    {
      id: 3,
      type: 'Enclosed',
      capacity: '8 tonnes',
      owner: 'Safe Haul Trailers',
      location: 'Graniteside (12km away)',
      rate: 120,
      rating: 4.8,
      condition: 'Excellent'
    }
  ];

  const navigateTo = (screen) => {
    if (navigation) {
      navigation.navigate(screen);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigateTo('JobDetails')}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rent a Trailer</Text>
        <Text style={styles.headerSubtitle}>I have truck, need trailer</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>How it works</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>1. Select a trailer near your location</Text>
              <Text style={styles.infoItem}>2. Rental fee is deducted from your earnings</Text>
              <Text style={styles.infoItem}>3. Damage deposit held in escrow ($200)</Text>
              <Text style={styles.infoItem}>4. Return trailer after delivery</Text>
            </View>
          </View>

          {/* Available Trailers */}
          <Text style={styles.sectionTitle}>Available Trailers</Text>
          <View style={styles.trailersList}>
            {availableTrailers.map((trailer) => (
              <TrailerCard
                key={trailer.id}
                trailer={trailer}
                selected={selectedTrailer?.id === trailer.id}
                onSelect={() => setSelectedTrailer(trailer)}
              />
            ))}
          </View>

          {/* Rental Terms */}
          {selectedTrailer && (
            <View style={styles.termsCard}>
              <Text style={styles.termsTitle}>Rental Terms</Text>
              <View style={styles.termsList}>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Daily rate</Text>
                  <Text style={styles.termValue}>${selectedTrailer.rate}/day</Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Damage deposit</Text>
                  <Text style={styles.termValue}>$200 (refundable)</Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Rental period</Text>
                  <Text style={styles.termValue}>Pickup to return</Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Insurance</Text>
                  <Text style={styles.termValue}>Both parties must have valid</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.rentButton,
            !selectedTrailer && styles.rentButtonDisabled
          ]}
          onPress={() => navigateTo('TrailerRentalConfirm')}
          disabled={!selectedTrailer}
        >
          <Text style={styles.rentButtonText}>Rent This Trailer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const TrailerCard = ({ trailer, selected, onSelect }) => (
  <TouchableOpacity 
    style={[
      styles.trailerCard,
      selected && styles.trailerCardSelected
    ]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={styles.trailerHeader}>
      <View style={styles.trailerType}>
        <MaterialIcons name="local-shipping" size={20} color="#F37021" />
        <Text style={styles.trailerTypeText}>{trailer.type}</Text>
      </View>
      <View style={styles.rating}>
        <MaterialIcons name="star" size={16} color="#F37021" />
        <Text style={styles.ratingText}>{trailer.rating}</Text>
      </View>
    </View>
    
    <Text style={styles.capacity}>{trailer.capacity}</Text>
    
    <View style={styles.trailerDetails}>
      <View style={styles.detailRow}>
        <MaterialIcons name="business" size={16} color="#F37021" />
        <Text style={styles.detailText}>{trailer.owner}</Text>
      </View>
      <View style={styles.detailRow}>
        <MaterialIcons name="location-on" size={16} color="#F37021" />
        <Text style={styles.detailText}>{trailer.location}</Text>
      </View>
      <View style={styles.detailRow}>
        <MaterialIcons name="check-circle" size={16} color="#F37021" />
        <Text style={styles.detailText}>{trailer.condition} condition</Text>
      </View>
    </View>
    
    <View style={styles.trailerFooter}>
      <Text style={styles.rate}>${trailer.rate}/day</Text>
      {selected && (
        <MaterialIcons name="check-circle" size={24} color="#F37021" />
      )}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 45,
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
    marginBottom: 4,
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
  },
  infoBanner: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  trailersList: {
    gap: 12,
    marginBottom: 24,
  },
  trailerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  trailerCardSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#faf5ff',
  },
  trailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trailerType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailerTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  capacity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  trailerDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  trailerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  termsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 24,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  termsList: {
    gap: 12,
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  termValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  rentButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  rentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default TrailerRentalScreen;