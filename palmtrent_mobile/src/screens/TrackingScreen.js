import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';

const { width } = Dimensions.get('window');

// Status Step Component for waiting states
const StatusStep = ({ label, completed, active }) => (
  <View style={statusStepStyles.container}>
    <View style={[
      statusStepStyles.dot,
      completed && statusStepStyles.dotCompleted,
      active && statusStepStyles.dotActive
    ]}>
      {completed && <MaterialIcons name="check" size={12} color="white" />}
    </View>
    <Text style={[
      statusStepStyles.label,
      completed && statusStepStyles.labelCompleted,
      active && statusStepStyles.labelActive
    ]}>
      {label}
    </Text>
  </View>
);

const statusStepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dotCompleted: {
    backgroundColor: '#16a34a',
  },
  dotActive: {
    backgroundColor: '#0C2D48',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  labelCompleted: {
    color: '#16a34a',
  },
  labelActive: {
    color: '#0C2D48',
    fontWeight: '600',
  },
});

const TrackingScreen = ({ navigation, onNavigate, route }) => {
  const { user } = useAuth();
  const shipmentId = route?.params?.shipmentId;
  const bookingId = route?.params?.bookingId;
  const rentalId = route?.params?.rentalId;

  const [jobDetails, setJobDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const isTrailerOwner = user?.userType === 'trailer_owner';

  const fetchShipmentData = useCallback(async () => {
    try {
      setError(null);
      let response;

      // Handle trailer owner - fetch rentals instead of shipments
      if (isTrailerOwner) {
        if (rentalId) {
          response = await apiService.request(`/rentals/${rentalId}`);
        } else {
          response = await apiService.request('/rentals/active');
        }

        if (response.success && response.data) {
          const rental = Array.isArray(response.data) ? response.data[0] : response.data;

          if (rental) {
            const progress = calculateRentalProgress(rental);

            setJobDetails({
              id: rental.rentalReference || rental._id?.slice(-8).toUpperCase(),
              rentalId: rental._id,
              status: rental.status,
              progress,
              isRental: true,
              renter: {
                name: rental.renter?.name || 'Renter',
                rating: rental.renter?.rating?.average || 4.5,
                phone: rental.renter?.phone || 'Not available'
              },
              trailer: {
                type: rental.trailer?.trailerType || 'Trailer',
                registration: rental.trailer?.registration || 'N/A',
                location: rental.trailer?.currentLocation?.address || 'Location updating...'
              },
              route: {
                from: rental.pickupLocation || 'Pickup Location',
                to: rental.returnLocation || 'Return Location',
                distance: 0,
                covered: 0,
                remaining: 0
              },
              timing: {
                started: formatTime(rental.startDate),
                eta: formatTime(rental.endDate),
                elapsed: calculateElapsed(rental.startDate)
              },
              currentLocation: rental.trailer?.currentLocation?.address || 'Location updating...',
              recentActivity: formatRentalActivityLog(rental),
              rawData: rental
            });
          } else {
            setJobDetails(null);
          }
        } else {
          setJobDetails(null);
        }
      } else {
        // Handle shipper/transporter - fetch shipments
        if (shipmentId) {
          response = await apiService.request(`/shipments/${shipmentId}`);
        } else if (bookingId) {
          response = await apiService.request(`/bookings/${bookingId}`);
        } else {
          response = await apiService.request('/shipments/active');
        }

        if (response.success && response.data) {
          const shipment = Array.isArray(response.data) ? response.data[0] : response.data;

          if (shipment) {
            const distance = shipment.route?.distance || 0;
            const progress = calculateProgress(shipment);
            const covered = Math.round(distance * (progress / 100));

            setJobDetails({
              id: shipment.bookingReference || shipment._id,
              shipmentId: shipment._id,
              status: shipment.status,
              progress,
              isRental: false,
              driver: {
                name: shipment.transporter?.name || shipment.driver?.name || 'Transporter',
                rating: shipment.transporter?.rating?.average || 4.5,
                phone: shipment.transporter?.phone || 'Not available',
                vehicle: shipment.vehicle?.registration || 'Not assigned'
              },
              route: {
                from: shipment.route?.pickup?.address || shipment.route?.pickup?.city || 'Pickup',
                to: shipment.route?.delivery?.address || shipment.route?.delivery?.city || 'Delivery',
                distance,
                covered,
                remaining: distance - covered
              },
              timing: {
                started: formatTime(shipment.timeline?.pickedUpAt),
                eta: calculateETA(shipment),
                elapsed: calculateElapsed(shipment.timeline?.pickedUpAt)
              },
              currentLocation: shipment.tracking?.currentLocation?.address || 'Location updating...',
              recentActivity: formatActivityLog(shipment),
              rawData: shipment
            });
          } else {
            setJobDetails(null);
          }
        } else {
          setJobDetails(null);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load tracking data');
      setJobDetails(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shipmentId, bookingId, rentalId, isTrailerOwner]);

  const calculateRentalProgress = (rental) => {
    const statusProgress = {
      'pending': 10,
      'confirmed': 25,
      'active': 50,
      'returning': 75,
      'completed': 100,
      'cancelled': 0
    };
    return statusProgress[rental.status] || 0;
  };

  const formatRentalActivityLog = (rental) => {
    const activities = [];

    if (rental.completedAt) {
      activities.push({ time: formatTime(rental.completedAt), event: 'Rental completed', type: 'delivery' });
    }
    if (rental.status === 'active') {
      activities.push({ time: formatTime(rental.startDate), event: 'Rental started', type: 'pickup' });
    }
    if (rental.confirmedAt) {
      activities.push({ time: formatTime(rental.confirmedAt), event: 'Rental confirmed', type: 'assigned' });
    }
    if (rental.createdAt) {
      activities.push({ time: formatTime(rental.createdAt), event: 'Rental request created', type: 'pending' });
    }

    return activities.length > 0 ? activities : [
      { time: '--:--', event: 'Waiting for updates...', type: 'pending' }
    ];
  };

  useEffect(() => {
    fetchShipmentData();
    // Refresh every 30 seconds for live tracking
    const interval = setInterval(fetchShipmentData, 30000);
    return () => clearInterval(interval);
  }, [fetchShipmentData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShipmentData();
  }, [fetchShipmentData]);

  const calculateProgress = (shipment) => {
    const statusProgress = {
      'pending': 0,
      'payment_confirmed': 5,
      'finding_transporter': 10,
      'transporter_assigned': 15,
      'assigned': 15,
      'en_route_pickup': 25,
      'picked_up': 40,
      'in_transit': 60,
      'arrived_delivery': 85,
      'delivered': 95,
      'completed': 100
    };
    return statusProgress[shipment.status] || 0;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const calculateETA = (shipment) => {
    if (shipment.schedule?.estimatedArrival) {
      return formatTime(shipment.schedule.estimatedArrival);
    }
    // Estimate based on distance (average 60 km/h)
    const distance = shipment.route?.distance || 0;
    const hours = distance / 60;
    const eta = new Date(Date.now() + hours * 60 * 60 * 1000);
    return formatTime(eta);
  };

  const calculateElapsed = (startTime) => {
    if (!startTime) return '--';
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatActivityLog = (shipment) => {
    const activities = [];
    const timeline = shipment.timeline || {};

    if (timeline.deliveredAt) {
      activities.push({ time: formatTime(timeline.deliveredAt), event: 'Delivery completed', type: 'delivery' });
    }
    if (timeline.arrivedDeliveryAt) {
      activities.push({ time: formatTime(timeline.arrivedDeliveryAt), event: 'Arrived at delivery location', type: 'arrival' });
    }
    if (timeline.inTransitAt) {
      activities.push({ time: formatTime(timeline.inTransitAt), event: 'In transit to destination', type: 'transit' });
    }
    if (timeline.pickedUpAt) {
      activities.push({ time: formatTime(timeline.pickedUpAt), event: 'Pickup completed', type: 'pickup' });
    }
    if (timeline.enRoutePickupAt) {
      activities.push({ time: formatTime(timeline.enRoutePickupAt), event: 'Transporter en route to pickup', type: 'enroute' });
    }
    if (timeline.transporterAssignedAt) {
      activities.push({ time: formatTime(timeline.transporterAssignedAt), event: 'Transporter assigned', type: 'assigned' });
    }

    return activities.length > 0 ? activities : [
      { time: '--:--', event: 'Waiting for updates...', type: 'pending' }
    ];
  };

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const handleCallDriver = () => {
    Alert.alert('Call Driver', `Call ${jobDetails.driver.phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => console.log('Calling driver...') }
    ]);
  };

  const handleMessageDriver = () => {
    navigateTo('Chat', { driver: jobDetails.driver });
  };

  const handleShareTracking = () => {
    Alert.alert('Share Tracking', 'Tracking link copied to clipboard!');
  };

  const handleReportIssue = () => {
    navigateTo('ReportIssue', { jobId: jobDetails.id });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_transit': return '#0C2D48';
      case 'completed': return '#16a34a';
      case 'pending': return '#ea580c';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_transit': return 'In Transit 🚛';
      case 'completed': return 'Completed ✅';
      case 'pending': return 'Pending ⏳';
      default: return status;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'pickup': return 'check-circle';
      case 'stop': return 'access-time';
      case 'checkpoint': return 'verified';
      default: return 'info';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'pickup': return '#16a34a';
      case 'delivery': return '#16a34a';
      case 'stop': return '#ea580c';
      case 'checkpoint': return '#0C2D48';
      case 'transit': return '#0C2D48';
      case 'enroute': return '#f59e0b';
      case 'assigned': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <Text style={styles.jobId}>Tracking</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading tracking data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!jobDetails) {
    const isTransporter = user?.userType === 'transporter';

    const getEmptyTitle = () => {
      if (isTrailerOwner) return 'No Active Rentals';
      if (isTransporter) return 'No Active Deliveries';
      return 'No Active Shipments';
    };

    const getEmptySubtitle = () => {
      if (isTrailerOwner) return 'Your trailer rentals will appear here when they are active';
      if (isTransporter) return 'Accept a job from Available Jobs to start tracking your deliveries';
      return 'Your shipments will appear here once a transporter has been assigned and is in transit';
    };

    const getEmptyIcon = () => {
      if (isTrailerOwner) return 'rv-hookup';
      return 'local-shipping';
    };

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <View style={styles.headerWithBack}>
            {navigation && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}
            <Text style={styles.jobId}>{isTrailerOwner ? 'Rental Tracking' : 'Tracking'}</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name={getEmptyIcon()} size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{getEmptyTitle()}</Text>
          <Text style={styles.emptySubtitle}>{getEmptySubtitle()}</Text>
          <TouchableOpacity style={styles.refreshButtonLarge} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
          {isTrailerOwner ? (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('TrailerList')}
            >
              <Text style={styles.viewJobsButtonText}>View My Trailers</Text>
            </TouchableOpacity>
          ) : isTransporter ? (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('AvailableJobs')}
            >
              <Text style={styles.viewJobsButtonText}>View Available Jobs</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('BookingHistory')}
            >
              <Text style={styles.viewJobsButtonText}>View My Bookings</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Check if waiting for transporter
  const waitingStatuses = ['pending', 'payment_confirmed', 'finding_transporter'];
  if (waitingStatuses.includes(jobDetails.status)) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <View style={styles.headerWithBack}>
            {navigation && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.jobIdLabel}>Booking</Text>
              <Text style={styles.jobId}>{jobDetails.id}</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.waitingContainer}>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="large" color="#0C2D48" />
              <Text style={styles.waitingTitle}>
                {jobDetails.status === 'finding_transporter'
                  ? 'Finding a Transporter'
                  : jobDetails.status === 'payment_confirmed'
                  ? 'Payment Confirmed'
                  : 'Booking Pending'
                }
              </Text>
              <Text style={styles.waitingSubtitle}>
                {jobDetails.status === 'finding_transporter'
                  ? 'We\'re matching your shipment with the best available transporter. This usually takes 1-2 hours.'
                  : jobDetails.status === 'payment_confirmed'
                  ? 'Your payment has been received. We\'re now looking for a transporter.'
                  : 'Your booking is being processed. Please complete payment to proceed.'
                }
              </Text>
            </View>

            {/* Route Preview */}
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
              <Text style={styles.cardTitle}>Route Details</Text>
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.routeDotStart]} />
                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>PICKUP</Text>
                  <Text style={styles.routeText}>{jobDetails.route.from}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.routeDotEnd]} />
                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>DELIVERY</Text>
                  <Text style={styles.routeText}>{jobDetails.route.to}</Text>
                </View>
              </View>
              <View style={styles.distanceRow}>
                <MaterialIcons name="straighten" size={16} color="#6b7280" />
                <Text style={styles.distanceText}>{jobDetails.route.distance} km</Text>
              </View>
            </View>

            {/* Status Steps */}
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
              <Text style={styles.cardTitle}>Booking Status</Text>
              <View style={styles.statusSteps}>
                <StatusStep
                  label="Booking Created"
                  completed={true}
                  active={jobDetails.status === 'pending'}
                />
                <StatusStep
                  label="Payment Confirmed"
                  completed={jobDetails.status !== 'pending'}
                  active={jobDetails.status === 'payment_confirmed'}
                />
                <StatusStep
                  label="Finding Transporter"
                  completed={false}
                  active={jobDetails.status === 'finding_transporter'}
                />
                <StatusStep
                  label="Transporter Assigned"
                  completed={false}
                  active={false}
                />
              </View>
            </View>

            {/* Actions */}
            {jobDetails.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.payButton, { marginHorizontal: 16, marginTop: 16 }]}
                onPress={() => navigation?.navigate('MobileMoneyPayment', { bookingId: jobDetails.shipmentId })}
              >
                <MaterialIcons name="payment" size={20} color="white" />
                <Text style={styles.emergencyButtonText}>Complete Payment</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton, { marginHorizontal: 16, marginTop: 16 }]}
              onPress={() => navigation?.navigate('JobDetails', { bookingId: jobDetails.shipmentId })}
            >
              <MaterialIcons name="info" size={20} color="#0C2D48" />
              <Text style={styles.shareButtonText}>View Booking Details</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.jobIdLabel}>Job ID</Text>
            <Text style={styles.jobId}>{jobDetails.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(jobDetails.status) }]}>
            <Text style={styles.statusText}>{getStatusText(jobDetails.status)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C2D48']} />
        }
      >
        {/* Map Section */}
        <View style={styles.mapSection}>
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="location-on" size={48} color="#0C2D48" />
            <Text style={styles.mapTitle}>Live GPS Tracking</Text>
            <Text style={styles.mapSubtitle}>Real-time location updates</Text>
          </View>
          
          {/* Current Location Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="navigation" size={20} color="#0C2D48" />
              <Text style={styles.locationLabel}>Current Location</Text>
            </View>
            <Text style={styles.locationText}>{jobDetails.currentLocation}</Text>
            <TouchableOpacity style={styles.viewMapButton}>
              <Text style={styles.viewMapText}>View Full Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <Text style={styles.cardTitle}>Trip Progress</Text>
              <Text style={styles.progressPercentage}>{jobDetails.progress}%</Text>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${jobDetails.progress}%` }]}
              />
            </View>
            
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{jobDetails.route.covered} km</Text>
                <Text style={styles.progressStatLabel}>Covered</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{jobDetails.route.remaining} km</Text>
                <Text style={styles.progressStatLabel}>Remaining</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{jobDetails.route.distance} km</Text>
                <Text style={styles.progressStatLabel}>Total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Route Details</Text>
            
            {/* From Location */}
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotStart]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeText}>{jobDetails.route.from}</Text>
                <Text style={styles.routeTime}>✓ Picked up at {jobDetails.timing.started}</Text>
              </View>
            </View>

            {/* Route Line */}
            <View style={styles.routeLine} />

            {/* To Location */}
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeText}>{jobDetails.route.to}</Text>
                <Text style={styles.routeTime}>⏰ ETA: {jobDetails.timing.eta}</Text>
              </View>
            </View>

            {/* Timing Stats */}
            <View style={styles.timingStats}>
              <View style={styles.timingStat}>
                <MaterialIcons name="schedule" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>{jobDetails.timing.elapsed}</Text>
                <Text style={styles.timingStatLabel}>Elapsed</Text>
              </View>
              <View style={styles.timingStat}>
                <MaterialIcons name="timer" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>{jobDetails.timing.eta}</Text>
                <Text style={styles.timingStatLabel}>ETA</Text>
              </View>
              <View style={styles.timingStat}>
                <MaterialIcons name="speed" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>62 km/h</Text>
                <Text style={styles.timingStatLabel}>Avg Speed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driver Information */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Driver Information</Text>
            
            <View style={styles.driverProfile}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitial}>
                  {jobDetails.driver.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{jobDetails.driver.name}</Text>
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.ratingText}>{jobDetails.driver.rating}</Text>
                  <Text style={styles.ratingCount}>• 45 trips</Text>
                </View>
              </View>
            </View>

            {/* Vehicle Info */}
            <View style={styles.vehicleCard}>
              <MaterialIcons name="local-shipping" size={20} color="#0C2D48" />
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleLabel}>VEHICLE</Text>
                <Text style={styles.vehicleText}>{jobDetails.driver.vehicle}</Text>
              </View>
            </View>

            {/* Contact Buttons */}
            <View style={styles.contactButtons}>
              <TouchableOpacity 
                style={[styles.contactButton, styles.callButton]}
                onPress={handleCallDriver}
              >
                <MaterialIcons name="phone" size={20} color="white" />
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.contactButton, styles.messageButton]}
                onPress={handleMessageDriver}
              >
                <MaterialIcons name="message" size={20} color="white" />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            
            <View style={styles.activityList}>
              {jobDetails.recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: `${getActivityColor(activity.type)}20` }]}>
                    <MaterialIcons 
                      name={getActivityIcon(activity.type)} 
                      size={16} 
                      color={getActivityColor(activity.type)} 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>{activity.event}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShareTracking}
          >
            <MaterialIcons name="share" size={20} color="#0C2D48" />
            <Text style={styles.shareButtonText}>Share Tracking Link</Text>
          </TouchableOpacity>

          {/* Show Rate Driver button for shippers when delivery is completed */}
          {(jobDetails.status === 'completed' || jobDetails.status === 'delivered') && user?.userType === 'shipper' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rateButton]}
              onPress={() => navigateTo('Rating', {
                bookingId: jobDetails.shipmentId || jobDetails.rawData?._id,
                booking: jobDetails.rawData,
                userType: 'shipper'
              })}
            >
              <MaterialIcons name="star" size={20} color="white" />
              <Text style={styles.rateButtonText}>Rate Driver</Text>
            </TouchableOpacity>
          )}

          {/* Show transporter actions when not completed */}
          {user?.userType === 'transporter' && jobDetails.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.arriveButton]}
              onPress={() => navigateTo('DeliveryChecklist', { job: jobDetails })}
            >
              <MaterialIcons name="location-on" size={20} color="white" />
              <Text style={styles.emergencyButtonText}>Arrived at Destination</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.emergencyButton]}
            onPress={handleReportIssue}
          >
            <MaterialIcons name="warning" size={20} color="white" />
            <Text style={styles.emergencyButtonText}>Report Issue / Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
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
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobIdLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  jobId: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mapSection: {
    position: 'relative',
    marginBottom: 16,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  locationCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  viewMapButton: {
    alignSelf: 'flex-start',
  },
  viewMapText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0C2D48',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
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
    marginBottom: 4,
  },
  routeTime: {
    fontSize: 12,
    color: '#0C2D48',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginBottom: 8,
  },
  timingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timingStat: {
    alignItems: 'center',
    flex: 1,
  },
  timingStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 4,
    marginBottom: 2,
  },
  timingStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  driverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#0C2D48',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ratingCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  vehicleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButton: {
    backgroundColor: '#16a34a',
  },
  messageButton: {
    backgroundColor: '#0C2D48',
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  shareButton: {
    borderWidth: 2,
    borderColor: '#0C2D48',
    backgroundColor: 'transparent',
  },
  arriveButton: {
    borderWidth: 2,
    borderColor: '#0C2D48',
    backgroundColor: '#0C2D48',
  },
  shareButtonText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyButton: {
    backgroundColor: '#dc2626',
  },
  rateButton: {
    backgroundColor: '#f59e0b',
  },
  rateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20, // Reduced from 80 since no bottom nav
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshButtonLarge: {
    marginTop: 24,
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0C2D48',
  },
  viewJobsButtonText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  waitingContainer: {
    paddingTop: 16,
  },
  waitingCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusSteps: {
    paddingLeft: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  distanceText: {
    fontSize: 14,
    color: '#6b7280',
  },
  payButton: {
    backgroundColor: '#16a34a',
  },
});

export default TrackingScreen;