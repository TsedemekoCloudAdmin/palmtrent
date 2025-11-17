import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';

const { width } = Dimensions.get('window');

const TrackingScreen = ({ navigation, onNavigate }) => {
  const { user } = useAuth();
  
  const [jobDetails] = useState({
    id: 'PT-2025-001234',
    status: 'in_transit',
    progress: 48,
    driver: {
      name: 'Trust Ncube',
      rating: 4.8,
      phone: '+263 71 234 5678',
      vehicle: 'Toyota Hilux (ABD 1234)'
    },
    route: {
      from: 'Mbare Musika, Harare',
      to: 'National Foods, Bulawayo',
      distance: 440,
      covered: 210,
      remaining: 230
    },
    timing: {
      started: '06:15 AM',
      eta: '5:30 PM',
      elapsed: '3h 15m'
    },
    currentLocation: 'Near Chivhu',
    recentActivity: [
      { time: '12:30 PM', event: 'Fuel stop (Chivhu Total) - 10 mins', type: 'stop' },
      { time: '10:45 AM', event: 'VID checkpoint (cleared)', type: 'checkpoint' },
      { time: '06:15 AM', event: 'Pickup complete', type: 'pickup' }
    ]
  });

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
      case 'stop': return '#ea580c';
      case 'checkpoint': return '#0C2D48';
      default: return '#6b7280';
    }
  };

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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

          <TouchableOpacity 
            style={[styles.actionButton, styles.arriveButton]}
             onPress={() => navigateTo('DeliveryChecklist', { job: jobDetails })}
          >
            <MaterialIcons name="share" size={20} color="#0C2D48" />
            <Text style={styles.emergencyButtonText}>Arrived at Destination</Text>
          </TouchableOpacity>
          
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
  emergencyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20, // Reduced from 80 since no bottom nav
  },
});

export default TrackingScreen;