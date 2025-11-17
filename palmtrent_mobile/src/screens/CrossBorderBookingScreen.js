// screens/CrossBorderBookingScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const CrossBorderBookingScreen = ({ onNavigate, bookingData, updateBookingData }) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [documents, setDocuments] = useState({
    commercialInvoice: false,
    packingList: false,
    certificateOrigin: false,
    cargoManifest: false
  });

  const countries = [
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', border: 'Beitbridge', distance: 1000, popular: true },
    { code: 'BW', name: 'Botswana', flag: '🇧🇼', border: 'Plumtree', distance: 500, popular: true },
    { code: 'ZM', name: 'Zambia', flag: '🇿🇲', border: 'Chirundu', distance: 400, popular: true },
    { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', border: 'Forbes', distance: 300, popular: false }
  ];

  const handleContinue = () => {
    updateBookingData({
      crossBorder: true,
      destinationCountry: selectedCountry,
      requiredDocuments: documents
    });
    onNavigate('booking-review');
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
                  key={country.code}
                  country={country}
                  selected={selectedCountry?.code === country.code}
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
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Driver Requirements</Text>
                <View style={styles.requirementsList}>
                  <RequirementItem text="Valid passport (6+ months validity)" checked />
                  <RequirementItem text="Cross-border experience (10+ trips)" checked />
                  <RequirementItem text="Yellow Card insurance (SADC)" checked />
                  <RequirementItem text="Valid vehicle documentation" checked />
                </View>
              </View>

              {/* Document Checklist */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Required Documents</Text>
                <View style={styles.documentsList}>
                  <DocumentCheckItem
                    label="Commercial Invoice"
                    required
                    checked={documents.commercialInvoice}
                    onToggle={() => setDocuments({...documents, commercialInvoice: !documents.commercialInvoice})}
                  />
                  <DocumentCheckItem
                    label="Packing List"
                    required
                    checked={documents.packingList}
                    onToggle={() => setDocuments({...documents, packingList: !documents.packingList})}
                  />
                  <DocumentCheckItem
                    label="Certificate of Origin"
                    required
                    checked={documents.certificateOrigin}
                    onToggle={() => setDocuments({...documents, certificateOrigin: !documents.certificateOrigin})}
                  />
                  <DocumentCheckItem
                    label="Cargo Manifest"
                    required
                    checked={documents.cargoManifest}
                    onToggle={() => setDocuments({...documents, cargoManifest: !documents.cargoManifest})}
                  />
                </View>
              </View>

              {/* Border Information */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Border Information</Text>
                <View style={styles.borderInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Border Post</Text>
                    <Text style={styles.infoValue}>{selectedCountry.border}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Current Wait Time</Text>
                    <Text style={[styles.infoValue, styles.waitTime]}>2-4 hours</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Operating Hours</Text>
                    <Text style={styles.infoValue}>24/7</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Best Crossing Time</Text>
                    <Text style={[styles.infoValue, styles.bestTime]}>6AM - 10AM</Text>
                  </View>
                </View>
              </View>

              {/* Pricing */}
              <View style={styles.pricingCard}>
                <Text style={styles.cardTitle}>Pricing Estimate</Text>
                <View style={styles.pricingBreakdown}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Base transport</Text>
                    <Text style={styles.priceValue}>$800</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Cross-border surcharge</Text>
                    <Text style={styles.priceValue}>$50</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Yellow Card insurance</Text>
                    <Text style={styles.priceValue}>$50</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Documentation handling</Text>
                    <Text style={styles.priceValue}>$30</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Platform fee (12%)</Text>
                    <Text style={styles.priceValue}>$120</Text>
                  </View>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Estimate</Text>
                  <Text style={styles.totalValue}>$1,050</Text>
                </View>
              </View>
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
          <Text style={styles.countryName}>{country.name}</Text>
          {country.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={styles.countryDetails}>
          via {country.border} • {country.distance} km
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

const DocumentCheckItem = ({ label, required, checked, onToggle }) => (
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