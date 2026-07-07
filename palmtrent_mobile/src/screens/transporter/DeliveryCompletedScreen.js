import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';

const formatClock = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const DeliveryCompletedScreen = ({ navigation, route, onNavigate }) => {
  const { user } = useAuth();
  const job = route.params?.job;

  const earnings = job?.transporterEarnings
    ?? job?.pricing?.totals?.transporterTotal
    ?? job?.earnings
    ?? 0;
  const pickupTime = formatClock(job?.timeline?.pickedUpAt || job?.schedule?.actualPickupTime);
  const deliveryTime = formatClock(job?.timeline?.deliveredAt || job?.schedule?.actualDeliveryTime);
  const distanceKm = job?.route?.distance;

  const navigateTo = (screen, params = {}) => {
    if (onNavigate && typeof onNavigate === 'function') {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    } else {
      console.warn('No navigation available');
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header - Updated to match HomeScreen pattern */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigateTo('Home')}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Delivery Complete!</Text>
            <Text style={styles.jobId}>Job ID: {job?.id || job?.bookingReference || route.params?.shipmentId || 'Unavailable'}</Text>
          </View>
        </View>
        
        <View style={styles.ratingContainer}>
          <MaterialIcons name="star" size={16} color="#fbbf24" />
          <Text style={styles.ratingText}>{user?.rating?.average || 'N/A'}</Text>
          <Text style={styles.tripsText}>{user?.rating?.count ? ` - ${user.rating.count} trips` : ''}</Text>
          <Text style={styles.userTypeBadge}>
            {user?.userType === 'transporter' ? 'Transporter' : 'Shipper'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.centeredContainer}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={48} color="#16a34a" />
          </View>

          <Text style={styles.successTitle}>Delivery Complete!</Text>
          <Text style={styles.successSubtitle}>
            Excellent work! Your payment will be released in 24 hours.
          </Text>

          <View style={styles.summaryCard}>
            <View style={styles.earningsSection}>
              <Text style={styles.earningsLabel}>Your Earnings</Text>
              <Text style={styles.earningsAmount}>${Number(earnings).toLocaleString()}</Text>
              <Text style={styles.earningsSubtext}>Released 24 hours after delivery</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pickup</Text>
                <Text style={styles.statValue}>{pickupTime}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Delivery</Text>
                <Text style={styles.statValue}>{deliveryTime}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statValue, styles.successText]}>Delivered ✓</Text>
              </View>
              {distanceKm != null && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Distance</Text>
                  <Text style={styles.statValue}>{Number(distanceKm).toFixed(2)} km</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigateTo('Rating', {
                bookingId: job?._id || job?.bookingId || job?.id,
                booking: job,
                userType: user?.userType || 'transporter'
              })}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Rate This Shipper</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.outlineButton]}
              onPress={() => navigateTo('AvailableJobs')}
              activeOpacity={0.7}
            >
              <Text style={styles.outlineButtonText}>View Return Loads</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigateTo('Home')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  // Updated Header Styles to match HomeScreen
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tripsText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.75,
  },
  userTypeBadge: {
    color: 'white',
    fontSize: 12,
    backgroundColor: '#F37021',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 600, // Ensure enough space for scrolling
  },
  successIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#dcfce7',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 300,
  },
  summaryCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earningsSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  earningsSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statsContainer: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  successText: {
    color: '#16a34a',
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#0C2D48',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#0C2D48',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButtonText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeliveryCompletedScreen;
