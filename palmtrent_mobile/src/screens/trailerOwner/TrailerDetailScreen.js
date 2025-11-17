import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const TrailerDetailScreen = ({ navigation, route }) => {
  const { trailer } = route.params || {};
  const [trailerData, setTrailerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize trailer data with safe defaults
    const initializeTrailerData = () => {
      const defaultTrailer = {
        id: 1,
        name: 'Flatbed TR-001',
        type: 'Flatbed',
        capacity: '10 tonnes',
        licensePlate: 'ABC1234',
        vin: '1HGBH41JXMN109186',
        make: 'Mercedes',
        model: 'Actros',
        year: '2022',
        condition: 'Excellent',
        features: ['Tarpaulin Cover', 'GPS Tracking', 'ABS Brakes'],
        dailyRate: 80,
        weeklyRate: 500,
        monthlyRate: 1800,
        status: 'rented',
        location: 'Bulawayo',
        currentRental: {
          id: 1,
          customer: 'John Transport',
          startDate: '2024-01-15',
          endDate: '2024-01-18',
          totalAmount: 240,
          contact: '+263 77 123 4567',
          cargo: 'Construction materials',
          route: 'Harare to Bulawayo'
        },
        maintenanceHistory: [
          {
            id: 1,
            type: 'Routine Service',
            date: '2024-01-10',
            cost: 150,
            workshop: 'Harare Truck Services',
            nextService: '2024-04-10'
          }
        ]
      };

      setTrailerData({
        ...defaultTrailer,
        ...trailer,
        features: trailer?.features || defaultTrailer.features,
        maintenanceHistory: trailer?.maintenanceHistory || defaultTrailer.maintenanceHistory
      });
      setLoading(false);
    };

    initializeTrailerData();
  }, [trailer]);

  if (loading || !trailerData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading trailer details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const updateTrailerStatus = (newStatus) => {
    setTrailerData(prev => ({
      ...prev,
      status: newStatus
    }));
    Alert.alert('Status Updated', `Trailer marked as ${newStatus}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#16a34a';
      case 'rented': return '#F37021';
      case 'maintenance': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available': return 'check-circle';
      case 'rented': return 'local-shipping';
      case 'maintenance': return 'build';
      default: return 'help';
    }
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
        <Text style={styles.headerTitle}>{trailerData.name}</Text>
        <Text style={styles.headerSubtitle}>{trailerData.type} • {trailerData.capacity}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: getStatusColor(trailerData.status) + '20' }]}>
            <View style={styles.statusContent}>
              <MaterialIcons 
                name={getStatusIcon(trailerData.status)} 
                size={24} 
                color={getStatusColor(trailerData.status)} 
              />
              <View style={styles.statusTexts}>
                <Text style={[styles.statusTitle, { color: getStatusColor(trailerData.status) }]}>
                  {trailerData.status.charAt(0).toUpperCase() + trailerData.status.slice(1)}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {trailerData.status === 'rented' ? `With ${trailerData.currentRental?.customer}` :
                   trailerData.status === 'maintenance' ? 'At workshop for service' :
                   'Available for rental'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionButtons}>
            {trailerData.status === 'available' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.maintenanceButton]}
                onPress={() => updateTrailerStatus('maintenance')}
              >
                <MaterialIcons name="build" size={20} color="#dc2626" />
                <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>Mark for Maintenance</Text>
              </TouchableOpacity>
            )}
            {trailerData.status === 'rented' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.trackButton]}
                onPress={() => navigateTo('TrailerTracking', { trailer: trailerData })}
              >
                <MaterialIcons name="location-on" size={20} color="#0C2D48" />
                <Text style={[styles.actionButtonText, { color: '#0C2D48' }]}>Track Location</Text>
              </TouchableOpacity>
            )}
            {trailerData.status === 'maintenance' && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.availableButton]}
                onPress={() => updateTrailerStatus('available')}
              >
                <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                <Text style={[styles.actionButtonText, { color: '#16a34a' }]}>Mark Available</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.actionButton, styles.editButton]}
              onPress={() => navigateTo('EditTrailer', { trailer: trailerData })}
            >
              <MaterialIcons name="edit" size={20} color="#6b7280" />
              <Text style={[styles.actionButtonText, { color: '#6b7280' }]}>Edit Details</Text>
            </TouchableOpacity>
          </View>

          {/* Current Rental Info */}
          {trailerData.status === 'rented' && trailerData.currentRental && (
            <View style={styles.rentalCard}>
              <Text style={styles.cardTitle}>Current Rental</Text>
              <View style={styles.rentalDetails}>
                <DetailRow label="Customer" value={trailerData.currentRental.customer} />
                <DetailRow label="Contact" value={trailerData.currentRental.contact} />
                <DetailRow label="Rental Period" value={`${trailerData.currentRental.startDate} to ${trailerData.currentRental.endDate}`} />
                <DetailRow label="Cargo" value={trailerData.currentRental.cargo} />
                <DetailRow label="Route" value={trailerData.currentRental.route} />
                <DetailRow label="Total Amount" value={`$${trailerData.currentRental.totalAmount}`} highlight />
              </View>
              <View style={styles.rentalActions}>
                <TouchableOpacity style={styles.contactButton}>
                  <MaterialIcons name="phone" size={16} color="white" />
                  <Text style={styles.contactButtonText}>Call Customer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageButton}>
                  <MaterialIcons name="message" size={16} color="#0C2D48" />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trailer Specifications */}
          <View style={styles.specsCard}>
            <Text style={styles.cardTitle}>Specifications</Text>
            <View style={styles.specsGrid}>
              <SpecItem icon="local-shipping" label="Type" value={trailerData.type} />
              <SpecItem icon="fitness-center" label="Capacity" value={trailerData.capacity} />
              <SpecItem icon="confirmation-number" label="License" value={trailerData.licensePlate} />
              <SpecItem icon="fingerprint" label="VIN" value={trailerData.vin} />
              <SpecItem icon="business" label="Make" value={trailerData.make} />
              <SpecItem icon="model-training" label="Model" value={trailerData.model} />
              <SpecItem icon="calendar-today" label="Year" value={trailerData.year} />
              <SpecItem icon="check-circle" label="Condition" value={trailerData.condition} />
            </View>
          </View>

          {/* Features */}
          <View style={styles.featuresCard}>
            <Text style={styles.cardTitle}>Features & Equipment</Text>
            <View style={styles.featuresList}>
              {trailerData.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <MaterialIcons name="check" size={16} color="#16a34a" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Rental Rates */}
          <View style={styles.ratesCard}>
            <Text style={styles.cardTitle}>Rental Rates (USD)</Text>
            <View style={styles.ratesList}>
              <RateItem period="Daily" rate={trailerData.dailyRate} />
              <RateItem period="Weekly" rate={trailerData.weeklyRate} />
              <RateItem period="Monthly" rate={trailerData.monthlyRate} />
            </View>
          </View>

          {/* Maintenance History */}
          <View style={styles.maintenanceCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Maintenance History</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {trailerData.maintenanceHistory.map((record) => (
              <MaintenanceRecord key={record.id} record={record} />
            ))}
            <TouchableOpacity style={styles.addMaintenanceButton}>
              <MaterialIcons name="add" size={20} color="#0C2D48" />
              <Text style={styles.addMaintenanceText}>Add Maintenance Record</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Detail Row Component
const DetailRow = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
      {value}
    </Text>
  </View>
);

// Spec Item Component
const SpecItem = ({ icon, label, value }) => (
  <View style={styles.specItem}>
    <MaterialIcons name={icon} size={16} color="#6b7280" />
    <Text style={styles.specLabel}>{label}</Text>
    <Text style={styles.specValue}>{value}</Text>
  </View>
);

// Rate Item Component
const RateItem = ({ period, rate }) => (
  <View style={styles.rateItem}>
    <Text style={styles.ratePeriod}>{period}</Text>
    <Text style={styles.rateAmount}>${rate}</Text>
  </View>
);

// Maintenance Record Component
const MaintenanceRecord = ({ record }) => (
  <View style={styles.maintenanceRecord}>
    <View style={styles.recordHeader}>
      <Text style={styles.recordType}>{record.type}</Text>
      <Text style={styles.recordCost}>${record.cost}</Text>
    </View>
    <Text style={styles.recordDate}>{record.date}</Text>
    <Text style={styles.recordWorkshop}>{record.workshop}</Text>
    <Text style={styles.recordNext}>Next: {record.nextService}</Text>
  </View>
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
  statusBanner: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTexts: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  rentalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  rentalDetails: {
    gap: 12,
    marginBottom: 16,
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
  detailValueHighlight: {
    color: '#16a34a',
    fontWeight: 'bold',
  },
  rentalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C2D48',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  contactButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0C2D48',
    flex: 1,
    justifyContent: 'center',
  },
  messageButtonText: {
    color: '#0C2D48',
    fontSize: 12,
    fontWeight: '500',
  },
  specsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  specItem: {
    width: '47%',
    marginBottom: 12,
  },
  specLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  featuresCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  ratesCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  ratesList: {
    gap: 12,
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  ratePeriod: {
    fontSize: 14,
    color: '#374151',
  },
  rateAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  maintenanceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '500',
  },
  maintenanceRecord: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  recordCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  recordDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  recordWorkshop: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  recordNext: {
    fontSize: 11,
    color: '#F37021',
    fontStyle: 'italic',
  },
  addMaintenanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addMaintenanceText: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
});

export default TrailerDetailScreen;