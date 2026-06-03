import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';

const { width } = Dimensions.get('window');

const isUserVerifiedForJobs = (user) => (
  user?.isVerified ||
  user?.verification?.isVerified ||
  ['approved', 'verified'].includes(user?.verification?.status)
);

const isUsableSubscription = (subscription) => {
  if (!subscription || subscription.status !== 'active') return false;
  const paymentStatus = subscription.payment?.status || 'pending';
  if (!['paid', 'waived', 'not_required'].includes(paymentStatus)) return false;
  if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()) return false;
  return true;
};

const JobDetailsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { job, bookingId } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const isTransporter = user?.userType === 'transporter';
  const isShipper = user?.userType === 'shipper' || !user?.userType;
  const transporterVerified = isUserVerifiedForJobs(user);
  const hasActiveSubscription = isUsableSubscription(subscription);
  const accessBlocker = !isTransporter
    ? ''
    : !transporterVerified
      ? 'Your transporter verification must be approved before you can accept jobs.'
      : subscriptionLoading
        ? 'Checking your subscription before accepting jobs.'
        : !hasActiveSubscription
          ? 'An active paid transporter subscription is required before you can accept jobs.'
          : '';

  useEffect(() => {
    if (bookingId && !job) {
      fetchBookingDetails();
    } else if (job) {
      setBookingData(job);
    }
  }, [bookingId, job]);

  useEffect(() => {
    if (!isTransporter) {
      setSubscriptionLoading(false);
      return;
    }

    const loadSubscription = async () => {
      try {
        setSubscriptionLoading(true);
        const response = await apiService.getMySubscription();
        setSubscription(response.data || null);
      } catch (error) {
        console.warn('Subscription status load failed:', error.message);
        setSubscription(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    loadSubscription();
  }, [isTransporter]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.request(`/bookings/${bookingId}`);
      if (response.success) {
        setBookingData(response.data);
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContactUser = () => {
    const phone = isShipper
      ? bookingData?.transporter?.phone
      : bookingData?.shipper?.phone || bookingData?.user?.phone;

    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Contact Unavailable', 'Phone number not available');
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.request(`/bookings/${bookingId || bookingData?._id}/cancel`, 'POST', {
                reason: 'User requested cancellation'
              });
              if (response.success) {
                Alert.alert('Success', 'Booking cancelled successfully');
                navigation.goBack();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            }
          }
        }
      ]
    );
  };
  
  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const jobData = bookingData || job;

  if (!jobData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="assignment" size={48} color="#9ca3af" />
          <Text style={styles.loadingText}>Job details are not available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Extract data from actual booking structure
  const displayData = {
    id: jobData.bookingReference || jobData.id || jobData._id?.slice(-8).toUpperCase(),
    route: {
      from: jobData.route?.pickup?.address || jobData.pickupLocation?.address || jobData.route?.from || 'Pickup',
      to: jobData.route?.delivery?.address || jobData.deliveryLocation?.address || jobData.route?.to || 'Delivery'
    },
    distance: jobData.route?.distance || jobData.distance || 0,
    earnings: jobData.pricing?.totals?.transporterTotal || jobData.earnings || 0,
    totalPrice: jobData.pricing?.totals?.total || jobData.totalPrice || jobData.totalAmount || 0,
    status: jobData.status || 'pending',
    shipper: jobData.shipper || jobData.user || { name: 'Customer', rating: 0 },
    transporter: jobData.transporter,
    cargoDetails: jobData.cargoDetails || { type: 'General', weight: 0 },
    pickup: jobData.pickup || {
      date: jobData.route?.pickup?.date || 'TBD',
      time: 'TBD'
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.backButtonText}>
              {isTransporter ? 'Back to Jobs' : 'Back'}
            </Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>
              {isTransporter ? 'Job Details' : 'Booking Details'}
            </Text>
            <Text style={styles.jobId}>{displayData.id}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Price/Earnings Highlight */}
        <View style={styles.section}>
          <View style={[styles.earningsCard, isShipper && { backgroundColor: '#0C2D48' }]}>
            <Text style={styles.earningsLabel}>
              {isTransporter ? 'Your Earnings' : 'Total Cost'}
            </Text>
            <Text style={styles.earningsAmount}>
              ${isTransporter ? displayData.earnings : displayData.totalPrice}
            </Text>
            <View style={styles.earningsBadge}>
              <MaterialIcons name="check-circle" size={16} color="white" />
              <Text style={styles.earningsBadgeText}>
                {isTransporter ? 'Payment guaranteed via escrow' : 'Secure payment'}
              </Text>
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
                <Text style={styles.routeText}>{displayData.route.from}</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>DELIVERY</Text>
                <Text style={styles.routeText}>{displayData.route.to}</Text>
              </View>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Distance</Text>
                <Text style={styles.routeStatValue}>{displayData.distance} km</Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Est. Duration</Text>
                <Text style={styles.routeStatValue}>{Math.ceil(displayData.distance / 60)} hours</Text>
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
                  {(jobData.shipper?.name || jobData.user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.shipperInfo}>
                <Text style={styles.shipperName}>{jobData.shipper?.name || jobData.user?.name || 'Customer'}</Text>
                <View style={styles.shipperRating}>
                  <MaterialIcons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.ratingText}>{jobData.shipper?.rating || jobData.user?.rating || 0}</Text>
                  <Text style={styles.tripsText}>• {jobData.shipper?.trips || jobData.user?.completedTrips || 0} trips</Text>
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
              <DetailRow label="Date" value={displayData.pickup?.date || 'TBD'} />
              <DetailRow label="Time Window" value={displayData.pickup?.time || 'TBD'} />
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

        {/* Actions - User Type Aware */}
        <View style={styles.section}>
          {isTransporter ? (
            // Transporter Actions
            <View style={styles.actionButtonsColumn}>
              {accessBlocker ? (
                <View style={styles.accessNotice}>
                  <MaterialIcons
                    name={transporterVerified ? 'workspace-premium' : 'verified-user'}
                    size={22}
                    color="#0C2D48"
                  />
                  <Text style={styles.accessNoticeText}>{accessBlocker}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.acceptButton, accessBlocker && styles.acceptButtonDisabled]}
                onPress={() => {
                  if (accessBlocker) {
                    Alert.alert('Action Required', accessBlocker);
                    return;
                  }
                  navigateTo('AcceptJobConfirmation', { job: jobData });
                }}
              >
                <Text style={styles.acceptButtonText}>{accessBlocker ? 'View Only' : 'Accept Job'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Shipper Actions
            <View style={styles.actionButtonsColumn}>
              {/* Track Shipment - show if transporter assigned */}
              {displayData.transporter && ['transporter_assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'].includes(displayData.status) && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigateTo('TrackShipment', { bookingId: bookingId || jobData._id })}
                >
                  <MaterialIcons name="location-on" size={20} color="white" />
                  <Text style={styles.primaryButtonText}>Track Shipment</Text>
                </TouchableOpacity>
              )}

              {/* Contact Transporter */}
              {displayData.transporter && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleContactUser}
                >
                  <MaterialIcons name="phone" size={20} color="#0C2D48" />
                  <Text style={styles.secondaryButtonText}>Contact Transporter</Text>
                </TouchableOpacity>
              )}

              {/* Rate - show if delivered or completed */}
              {['delivered', 'completed'].includes(displayData.status) && (
                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => navigateTo('Rating', { bookingId: bookingId || jobData._id, type: 'transporter' })}
                >
                  <MaterialIcons name="star" size={20} color="#F37021" />
                  <Text style={styles.rateButtonText}>Rate Transporter</Text>
                </TouchableOpacity>
              )}

              {/* Cancel - show if cancellable */}
              {['pending', 'pending_payment', 'payment_confirmed', 'finding_transporter'].includes(displayData.status) && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelBooking}
                >
                  <MaterialIcons name="cancel" size={20} color="#ef4444" />
                  <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                </TouchableOpacity>
              )}

              {/* Report Issue */}
              {['delivered', 'completed'].includes(displayData.status) && (
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => navigateTo('Dispute', { bookingId: bookingId || jobData._id })}
                >
                  <MaterialIcons name="report-problem" size={20} color="#6b7280" />
                  <Text style={styles.reportButtonText}>Report an Issue</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
  accessNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 14,
  },
  accessNoticeText: {
    flex: 1,
    color: '#0C2D48',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
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
  acceptButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  actionButtonsColumn: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0C2D48',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 8,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F37021',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
});

export default JobDetailsScreen;
