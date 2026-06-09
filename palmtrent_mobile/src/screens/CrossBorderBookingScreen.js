// screens/CrossBorderBookingScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';

const CrossBorderBookingScreen = ({ navigation, route, onNavigate, bookingData, updateBookingData }) => {
  // Support both navigation patterns
  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      const screenMap = {
        'create-booking': 'CreateBooking',
        'booking-review': 'BookingReview',
      };
      navigation.navigate(screenMap[screen] || screen, params);
    }
  };
  const [loading, setLoading] = useState(true);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [borderInfo, setBorderInfo] = useState(null);
  const [documents, setDocuments] = useState({});
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState(null);

  // Fetch destinations on mount
  useEffect(() => {
    fetchDestinations();
  }, []);

  // Fetch border info and calculate price when country selected
  useEffect(() => {
    if (selectedCountry) {
      fetchBorderInfo(selectedCountry.countryCode);
      calculatePrice(selectedCountry.countryCode);
      initializeDocuments(selectedCountry);
    }
  }, [selectedCountry]);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.get('/cross-border/destinations');

      if (response.success) {
        setCountries(response.data);
      }
    } catch (err) {
      console.error('Error fetching destinations:', err);
      setError('Failed to load destinations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBorderInfo = async (countryCode) => {
    try {
      const response = await apiService.get(`/cross-border/border-posts/${countryCode}`);

      if (response.success) {
        setBorderInfo(response.data.borderPosts[0]); // Get first border post
      }
    } catch (err) {
      console.error('Error fetching border info:', err);
    }
  };

  const calculatePrice = async (countryCode) => {
    try {
      setCalculatingPrice(true);
      const basePrice = bookingData?.pricing?.basePrice || 800;

      const response = await apiService.post('/cross-border/calculate-price', {
        countryCode,
        basePrice,
        insuranceRequired: true
      });

      if (response.success) {
        setPricing(response.data);
      }
    } catch (err) {
      console.error('Error calculating price:', err);
    } finally {
      setCalculatingPrice(false);
    }
  };

  const initializeDocuments = (country) => {
    if (country.requiredDocuments) {
      const docState = {};
      country.requiredDocuments.forEach(doc => {
        docState[doc.name.toLowerCase().replace(/\s+/g, '')] = false;
      });
      setDocuments(docState);
    }
  };

  const toggleDocument = (docKey) => {
    setDocuments(prev => ({
      ...prev,
      [docKey]: !prev[docKey]
    }));
  };

  const handleContinue = () => {
    // Validate all required documents are checked
    if (selectedCountry?.requiredDocuments) {
      const allChecked = selectedCountry.requiredDocuments
        .filter(doc => doc.required)
        .every(doc => documents[doc.name.toLowerCase().replace(/\s+/g, '')]);

      if (!allChecked) {
        Alert.alert(
          'Documents Required',
          'Please confirm all required documents before continuing.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    updateBookingData({
      crossBorder: true,
      isCrossBorder: true,
      destinationCountry: selectedCountry,
      borderPost: borderInfo?.name || selectedCountry?.borderPosts?.[0]?.name,
      requiredDocuments: documents,
      crossBorderPricing: pricing
    });
    navigateTo('booking-review');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigateTo('create-booking')}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Cross-Border Shipping</Text>
            <Text style={styles.headerSubtitle}>SADC regional transport</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading destinations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigateTo('create-booking')}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Cross-Border Shipping</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDestinations}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateTo('create-booking')}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Cross-Border Shipping</Text>
          <Text style={styles.headerSubtitle}>SADC regional transport</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Country Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Destination Country</Text>
            <View style={styles.countriesContainer}>
              {countries.map((country) => (
                <CountryCard
                  key={country.countryCode}
                  country={country}
                  selected={selectedCountry?.countryCode === country.countryCode}
                  onSelect={() => setSelectedCountry(country)}
                />
              ))}
            </View>
          </View>

          {selectedCountry && (
            <>
              {/* Requirements Alert */}
              <View style={styles.alertCard}>
                <MaterialIcons name="warning" size={20} color="#92400e" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Additional Requirements</Text>
                  <Text style={styles.alertText}>
                    Cross-border shipments require additional documentation and insurance
                  </Text>
                </View>
              </View>

              {/* Driver Requirements */}
              {selectedCountry.driverRequirements && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Driver Requirements</Text>
                  <View style={styles.requirementsList}>
                    {selectedCountry.driverRequirements.map((req, index) => (
                      <RequirementItem
                        key={index}
                        text={req.requirement}
                        checked={req.mandatory}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Document Checklist */}
              {selectedCountry.requiredDocuments && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Required Documents</Text>
                  <View style={styles.documentsList}>
                    {selectedCountry.requiredDocuments.map((doc, index) => {
                      const docKey = doc.name.toLowerCase().replace(/\s+/g, '');
                      return (
                        <DocumentCheckItem
                          key={index}
                          label={doc.name}
                          description={doc.description}
                          required={doc.required}
                          checked={documents[docKey] || false}
                          onToggle={() => toggleDocument(docKey)}
                        />
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Border Information */}
              {borderInfo && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Border Information</Text>
                  <View style={styles.borderInfo}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Border Post</Text>
                      <Text style={styles.infoValue}>{borderInfo.name}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Status</Text>
                      <Text style={[
                        styles.infoValue,
                        borderInfo.currentStatus === 'open' ? styles.statusOpen : styles.statusCongested
                      ]}>
                        {borderInfo.currentStatus?.charAt(0).toUpperCase() + borderInfo.currentStatus?.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Wait Time</Text>
                      <Text style={[styles.infoValue, styles.waitTime]}>
                        {borderInfo.averageWaitTime?.min}-{borderInfo.averageWaitTime?.max} hours
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Operating Hours</Text>
                      <Text style={styles.infoValue}>{borderInfo.operatingHours}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Best Crossing Time</Text>
                      <Text style={[styles.infoValue, styles.bestTime]}>
                        {borderInfo.bestCrossingTimes}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Pricing */}
              {calculatingPrice ? (
                <View style={styles.pricingCard}>
                  <ActivityIndicator size="small" color="#0C2D48" />
                  <Text style={styles.calculatingText}>Calculating price...</Text>
                </View>
              ) : pricing && (
                <View style={styles.pricingCard}>
                  <Text style={styles.cardTitle}>Pricing Estimate</Text>
                  <View style={styles.pricingBreakdown}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Base transport</Text>
                      <Text style={styles.priceValue}>${pricing.breakdown.baseTransport}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Cross-border surcharge</Text>
                      <Text style={styles.priceValue}>${pricing.breakdown.crossBorderSurcharge}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Yellow Card insurance</Text>
                      <Text style={styles.priceValue}>${pricing.breakdown.yellowCardInsurance}</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Documentation handling</Text>
                      <Text style={styles.priceValue}>${pricing.breakdown.documentationHandling}</Text>
                    </View>
                    {pricing.breakdown.customsClearanceFee > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Customs clearance</Text>
                        <Text style={styles.priceValue}>${pricing.breakdown.customsClearanceFee}</Text>
                      </View>
                    )}
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Platform fee ({pricing.breakdown.platformFeePercentage}%)</Text>
                      <Text style={styles.priceValue}>${pricing.breakdown.platformFee}</Text>
                    </View>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Estimate</Text>
                    <Text style={styles.totalValue}>${pricing.total}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      {selectedCountry && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue to Review</Text>
            <MaterialIcons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

// Helper Components
const CountryCard = ({ country, selected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.countryCard,
      selected && styles.countryCardSelected
    ]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={styles.countryContent}>
      <Text style={styles.countryFlag}>{country.flag}</Text>
      <View style={styles.countryInfo}>
        <View style={styles.countryHeader}>
          <Text style={styles.countryName}>{country.countryName}</Text>
          {country.isPopular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={styles.countryDetails}>
          via {country.borderPosts?.[0]?.name || 'Border'} • {country.distanceFromOrigin?.value || 0} {country.distanceFromOrigin?.unit || 'km'}
        </Text>
      </View>
      {selected && (
        <MaterialIcons name="check-circle" size={24} color="#fbbf24" />
      )}
    </View>
  </TouchableOpacity>
);

const RequirementItem = ({ text, checked }) => (
  <View style={styles.requirementItem}>
    {checked ? (
      <MaterialIcons name="check-circle" size={20} color="#059669" />
    ) : (
      <View style={styles.uncheckedCircle} />
    )}
    <Text style={styles.requirementText}>{text}</Text>
  </View>
);

const DocumentCheckItem = ({ label, description, required, checked, onToggle }) => (
  <TouchableOpacity
    style={styles.documentItem}
    onPress={onToggle}
    activeOpacity={0.7}
  >
    <View style={styles.documentContent}>
      <View style={styles.checkboxContainer}>
        <View style={[
          styles.checkbox,
          checked && styles.checkboxChecked
        ]}>
          {checked && <MaterialIcons name="check" size={16} color="white" />}
        </View>
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentLabel}>{label}</Text>
        {required && <Text style={styles.requiredText}>* Required</Text>}
      </View>
    </View>
    <MaterialIcons name="description" size={20} color="#9ca3af" />
  </TouchableOpacity>
);

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  countriesContainer: {
    gap: 12,
  },
  countryCard: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  countryCardSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#faf5ff',
  },
  countryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryFlag: {
    fontSize: 32,
  },
  countryInfo: {
    flex: 1,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  popularBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  countryDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#92400e',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  requirementsList: {
    gap: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uncheckedCircle: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 10,
  },
  requirementText: {
    fontSize: 14,
    color: '#374151',
  },
  documentsList: {
    gap: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  documentInfo: {
    gap: 2,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  requiredText: {
    fontSize: 12,
    color: '#dc2626',
  },
  borderInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  statusOpen: {
    color: '#059669',
  },
  statusCongested: {
    color: '#ea580c',
  },
  waitTime: {
    color: '#ea580c',
  },
  bestTime: {
    color: '#059669',
  },
  pricingCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    padding: 16,
    gap: 16,
  },
  calculatingText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 8,
  },
  pricingBreakdown: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  bottomActions: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CrossBorderBookingScreen;
