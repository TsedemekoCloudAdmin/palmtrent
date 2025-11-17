import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';

const { width } = Dimensions.get('window');

const JobDetailsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { job } = route.params || {};
  
  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const jobData = job || {
    id: 'PT-2025-001234',
    route: { from: 'Harare', to: 'Bulawayo' },
    distance: 440,
    cargo: '5 tonnes maize in bags',
    earnings: 400,
    shipper: { name: 'John Moyo', rating: 4.8, trips: 45 },
    pickup: { date: 'Tomorrow', time: '6-12 PM' },
    payment: 'digital',
    expiresIn: 28,
    recommended: true,
    returnLoads: 2
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back to Jobs</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Job Details</Text>
            <Text style={styles.jobId}>{jobData.id}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Earnings Highlight */}
        <View style={styles.section}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Your Earnings</Text>
            <Text style={styles.earningsAmount}>${jobData.earnings}</Text>
            <View style={styles.earningsBadge}>
              <MaterialIcons name="check-circle" size={16} color="white" />
              <Text style={styles.earningsBadgeText}>Payment guaranteed via escrow</Text>
            </View>
          </View>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Route</Text>
            
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotStart]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeText}>{jobData.route.from}</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>DELIVERY</Text>
                <Text style={styles.routeText}>{jobData.route.to}</Text>
              </View>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Distance</Text>
                <Text style={styles.routeStatValue}>{jobData.distance} km</Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Est. Duration</Text>
                <Text style={styles.routeStatValue}>7-8 hours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cargo Details */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cargo Details</Text>
            <View style={styles.detailsList}>
              <DetailRow label="Type" value={jobData.cargo} />
              <DetailRow label="Weight" value="5,000 kg" />
              <DetailRow label="Quantity" value="100 bags x 50kg" />
              <DetailRow label="Value" value="$10,000 (Insured ✓)" highlight />
              <DetailRow label="Special Instructions" value="Keep dry, covered load" />
            </View>
          </View>
        </View>

        {/* Shipper Info */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shipper</Text>
            
            <View style={styles.shipperProfile}>
              <View style={styles.shipperAvatar}>
                <Text style={styles.shipperInitial}>
                  {jobData.shipper.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.shipperInfo}>
                <Text style={styles.shipperName}>{jobData.shipper.name}</Text>
                <View style={styles.shipperRating}>
                  <MaterialIcons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.ratingText}>{jobData.shipper.rating}</Text>
                  <Text style={styles.tripsText}>• {jobData.shipper.trips} trips</Text>
                </View>
              </View>
              <View style={styles.onTimeBadge}>
                <Text style={styles.onTimeText}>100% on-time</Text>
              </View>
            </View>

            <View style={styles.shipperDetails}>
              <Text style={styles.shipperDetail}>Payment History: Excellent ✓</Text>
              <Text style={styles.shipperDetail}>Member since: Jan 2025</Text>
            </View>
          </View>
        </View>

        {/* Pickup Details */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pickup Schedule</Text>
            <View style={styles.detailsList}>
              <DetailRow label="Date" value={jobData.pickup.date} />
              <DetailRow label="Time Window" value={jobData.pickup.time} />
              <DetailRow label="Loading" value="Shipper will load" />
              <DetailRow label="Offloading" value="Recipient will offload" />
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <View style={styles.detailsList}>
              <DetailRow label="Method" value="Digital (Escrow) ✓" highlight />
              <DetailRow label="Platform Fee" value="Paid by shipper" />
              <DetailRow label="Release" value="24 hours after delivery" />
              <DetailRow label="Your Payout" value={`$${jobData.earnings} to your account`} />
            </View>
          </View>
        </View>

        {/* Return Loads */}
        {jobData.returnLoads > 0 && (
          <View style={styles.section}>
            <View style={styles.returnLoadsCard}>
              <View style={styles.returnLoadsHeader}>
                <MaterialIcons name="inventory" size={20} color="#7c3aed" />
                <Text style={styles.returnLoadsTitle}>Return Load Opportunities</Text>
              </View>
              <Text style={styles.returnLoadsText}>
                {jobData.returnLoads} job{jobData.returnLoads > 1 ? 's' : ''} available from Bulawayo area
              </Text>
              <TouchableOpacity style={styles.returnLoadsButton}>
                <Text style={styles.returnLoadsButtonText}>View Return Loads →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <View style={styles.actionButtons}>
            {/*   <TouchableOpacity 
              style={styles.counterOfferButton}
              onPress={() => navigateTo('CounterOffer', { job: jobData })}
            >
              <Text style={styles.counterOfferButtonText}>Make Counter Offer</Text>
            </TouchableOpacity>*/}
         
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => navigateTo('AcceptJobConfirmation', { job: jobData })}
            >
              <Text style={styles.acceptButtonText}>Accept Job</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
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
    paddingTop: 45,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  jobId: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  earningsCard: {
    backgroundColor: '#F37021',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  earningsLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  earningsAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  earningsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsBadgeText: {
    color: 'white',
    fontSize: 14,
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
    marginBottom: 16,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  routeDotStart: {
    backgroundColor: '#16a34a',
  },
  routeDotEnd: {
    backgroundColor: '#0C2D48',
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginBottom: 8,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  routeStat: {
    alignItems: 'center',
  },
  routeStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  routeStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  detailsList: {
    gap: 12,
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
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  detailValueHighlight: {
    color: '#16a34a',
  },
  shipperProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shipperAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#0C2D48',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shipperInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  shipperInfo: {
    flex: 1,
  },
  shipperName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  shipperRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  tripsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  onTimeBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onTimeText: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '500',
  },
  shipperDetails: {
    gap: 4,
  },
  shipperDetail: {
    fontSize: 12,
    color: '#6b7280',
  },
  returnLoadsCard: {
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 12,
    padding: 16,
  },
  returnLoadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  returnLoadsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7c3aed',
  },
  returnLoadsText: {
    fontSize: 14,
    color: '#7c3aed',
    marginBottom: 12,
  },
  returnLoadsButton: {
    alignSelf: 'flex-start',
  },
  returnLoadsButtonText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  counterOfferButton: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#0C2D48',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterOfferButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 20,
  },
});

export default JobDetailsScreen;