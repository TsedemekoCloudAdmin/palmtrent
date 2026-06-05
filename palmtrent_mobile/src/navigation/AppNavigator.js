import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStackNavigator } from '@react-navigation/stack';
import useAuth from '../hook/useAuth';

// Import tab navigators
import ShipperTabs from './ShipperTabs';
import TransporterTabs from './TransporterTabs';
import TrailerOwnerTabs from './TrailerOwnerTabs';
import DriverTabs from './DriverTabs';
import ResponderTabs from './ResponderTabs';

// Import other screens
import HomeScreen from '../screens/HomeScreen';
import TransporterVerificationScreen from '../screens/transporter/TransporterVerificationScreen';
import CreateBookingScreen from '../screens/shipper/CreateBookingScreen';
import PendingJobsScreen from '../screens/transporter/PendingJobsScreen';
import AcceptJobConfirmationScreen from '../screens/transporter/AcceptJobConfirmationScreen';
import JobAcceptedScreen from '../screens/transporter/JobAcceptedScreen';
import PickupChecklistScreen from '../screens/transporter/PickupChecklistScreen';
import DeliveryChecklistScreen from '../screens/transporter/DeliveryChecklistScreen';
import DeliveryCompletedScreen from '../screens/transporter/DeliveryCompletedScreen';
import EarningsScreen from '../screens/transporter/EarningsScreen';
import HistoryScreen from '../screens/shipper/HistoryScreen';
import DisputeScreen from '../screens/shipper/DisputeScreen';
import TrackingScreen from '../screens/TrackingScreen';
import JobDetailsScreen from '../screens/JobDetailsScreen';
import AvailableJobsScreen from '../screens/AvailableJobs';
import ProfileScreen from '../screens/ProfileScreen';
import RatingScreen from '../screens/RatingScreen';
import BookingFlowManager from '../screens/BookingFlowManager';
import TrailerOwnerRegistration from '../screens/trailerOwner/TrailerOwnerRegistrationScreen';
import TrailerRental from '../screens/trailerOwner/TrailerRentalScreen';
import TrailerDetailScreen from '../screens/trailerOwner/TrailerDetailScreen';
import TrailerListScreen from '../screens/trailerOwner/TrailerListScreen';
import TrailerTrackingScreen from '../screens/trailerOwner/TrailerTrackingScreen';
import EditTrailerScreen from '../screens/trailerOwner/EditTrailerScreen';
import FleetAssetFormScreen from '../screens/trailerOwner/FleetAssetFormScreen';
import FleetRentalRequestsScreen from '../screens/trailerOwner/FleetRentalRequestsScreen';
import CorporateAccountSetup from '../screens/shipper/CorporateAccountSetupScreen';
import FleetDashboardScreen from '../screens/transporter/FleetDashboardScreen';
import AddDriverScreen from '../screens/transporter/AddDriverScreen';
import AddVehicleScreen from '../screens/transporter/AddVehicleScreen';
import VehicleDetailsScreen from '../screens/transporter/VehicleDetailsScreen';
import DriverDetailsScreen from '../screens/transporter/DriverDetailsScreen';
import EditVehicleScreen from '../screens/transporter/EditVehicleScreen';
import EditDriverScreen from '../screens/transporter/EditDriverScreen';
import VehicleRentalScreen from '../screens/transporter/VehicleRentalScreen';
import DriverMarketplaceScreen from '../screens/transporter/DriverMarketplaceScreen';
import DriverPortalScreen from '../screens/driver/DriverPortalScreen';
import RentalStaffScreen from '../screens/trailerOwner/RentalStaffScreen';
import ResponderPortalScreen from '../screens/emergency/ResponderPortalScreen';
import MobileMoneyPaymentScreen from '../screens/MobileMoneyPaymentScreen';
import CardPaymentScreen from '../screens/CardPaymentScreen';
import AgentPaymentScreen from '../screens/AgentPaymentScreen';
import NotificationScreen from '../screens/NotificationScreen';
import CrossBorderBookingScreen from '../screens/CrossBorderBookingScreen';
import BookingReviewScreen from '../screens/BookingReviewScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import TermsScreen from '../screens/TermsScreen';
import SupportScreen from '../screens/SupportScreen';
import ActivityHistoryScreen from '../screens/ActivityHistoryScreen';
import ReportIssueScreen from '../screens/ReportIssueScreen';
import ChatScreen from '../screens/ChatScreen';
import SubscriptionOnboardingScreen, { POST_REGISTRATION_SUBSCRIPTION_KEY } from '../screens/SubscriptionOnboardingScreen';


const Stack = createStackNavigator();

const getMainTabs = (userType) => {
  if (userType === 'transporter') return TransporterTabs;
  if (userType === 'trailer_owner' || userType === 'rental_owner') return TrailerOwnerTabs;
  if (userType === 'driver') return DriverTabs;
  if (userType === 'roadside_provider') return ResponderTabs;
  return ShipperTabs;
};

const AppNavigator = () => {
  const { user } = useAuth();
  const [initialRouteName, setInitialRouteName] = useState(null);

  useEffect(() => {
    let mounted = true;

    const resolveInitialRoute = async () => {
      const showSubscriptionPrompt = await AsyncStorage.getItem(POST_REGISTRATION_SUBSCRIPTION_KEY);
      if (mounted) {
        setInitialRouteName(showSubscriptionPrompt === 'true' ? 'SubscriptionOnboarding' : 'MainTabs');
      }
    };

    resolveInitialRoute();

    return () => {
      mounted = false;
    };
  }, [user?._id]);

  if (!initialRouteName) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F37021" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SubscriptionOnboarding" component={SubscriptionOnboardingScreen} />

      {/* Main Tab Navigator based on user type */}
      <Stack.Screen 
        name="MainTabs" 
        component={getMainTabs(user?.userType)}
      />
      
      {/* Common screens accessible from both user types */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="TransporterVerification" component={TransporterVerificationScreen} />
      <Stack.Screen name="CreateBooking" component={CreateBookingScreen} />
      <Stack.Screen name="PendingJobs" component={PendingJobsScreen} />
      <Stack.Screen name="BookingHistory" component={HistoryScreen} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
      <Stack.Screen name="Rating" component={RatingScreen} />
      <Stack.Screen name="Booking" component={BookingFlowManager} initialScreen="BookingStart" />
      
      {/* Shipper specific screens */}
      <Stack.Screen name="TrackShipment" component={TrackingScreen} />
      <Stack.Screen name="MyBookings" component={HistoryScreen} />
      <Stack.Screen name="Dispute" component={DisputeScreen} />
      <Stack.Screen name="CorporateAccountSetup" component={CorporateAccountSetup} />

       {/* Trailer specific screens */}
      <Stack.Screen name="TrailerDetail" component={TrailerDetailScreen} />
      <Stack.Screen name="TrailerList" component={TrailerListScreen} />
      <Stack.Screen name="TrailerOwnerRegistration" component={TrailerOwnerRegistration} />
      <Stack.Screen name="TrailerRental" component={TrailerRental} />
       <Stack.Screen name="TrailerTracking" component={TrailerTrackingScreen} />
        <Stack.Screen name="EditTrailer" component={EditTrailerScreen} />
        <Stack.Screen name="AddFleetAsset" component={FleetAssetFormScreen} />
        <Stack.Screen name="FleetRentalRequests" component={FleetRentalRequestsScreen} />
        <Stack.Screen name="RentalStaff" component={RentalStaffScreen} />
      
      {/* Transporter specific screens */}
      <Stack.Screen name="AvailableJobs" component={AvailableJobsScreen} />
      <Stack.Screen name="ActiveDeliveries" component={TrackingScreen} />
      <Stack.Screen name="MyEarnings" component={EarningsScreen} />
      <Stack.Screen name="AcceptJobConfirmation" component={AcceptJobConfirmationScreen} />
      <Stack.Screen name="JobAccepted" component={JobAcceptedScreen} />
      <Stack.Screen name="PickupChecklist" component={PickupChecklistScreen} />
      <Stack.Screen name="DeliveryChecklist" component={DeliveryChecklistScreen} />
      <Stack.Screen name="DeliveryCompleted" component={DeliveryCompletedScreen} />
       <Stack.Screen name="FleetDashboard" component={FleetDashboardScreen} />
       <Stack.Screen name="AddDriver" component={AddDriverScreen} />
       <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
       <Stack.Screen name="VehicleDetails" component={VehicleDetailsScreen} />
      <Stack.Screen name="DriverDetails" component={DriverDetailsScreen} />
      <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
      <Stack.Screen name="EditDriver" component={EditDriverScreen} />
      <Stack.Screen name="VehicleRental" component={VehicleRentalScreen} />
      <Stack.Screen name="DriverMarketplace" component={DriverMarketplaceScreen} />
      <Stack.Screen name="DriverPortal" component={DriverPortalScreen} />
      <Stack.Screen name="ResponderPortal" component={ResponderPortalScreen} />
      <Stack.Screen name="MyRentals" component={FleetRentalRequestsScreen} />

      {/* Payment screens */}
      <Stack.Screen name="MobileMoneyPayment" component={MobileMoneyPaymentScreen} />
      <Stack.Screen name="CardPayment" component={CardPaymentScreen} />
      <Stack.Screen name="AgentPayment" component={AgentPaymentScreen} />

      {/* Booking flow screens */}
      <Stack.Screen name="CrossBorderBooking" component={CrossBorderBookingScreen} />
      <Stack.Screen name="BookingReview" component={BookingReviewScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />

      {/* Notification screen */}
      <Stack.Screen name="Notifications" component={NotificationScreen} />

      {/* Settings and Info screens */}
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />

      {/* Communication and Support screens */}
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc'
  }
});

export default AppNavigator;
