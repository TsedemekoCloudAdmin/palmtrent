import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import useAuth from '../hook/useAuth';

// Import tab navigators
import ShipperTabs from './ShipperTabs';
import TransporterTabs from './TransporterTabs';

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
import CorporateAccountSetup from '../screens/shipper/CorporateAccountSetupScreen';


const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <Stack.Navigator 
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false }}
    >
      {/* Main Tab Navigator based on user type */}
      <Stack.Screen 
        name="MainTabs" 
        component={user?.userType === 'transporter' ? TransporterTabs : ShipperTabs}
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
      
      {/* Transporter specific screens */}
      <Stack.Screen name="AvailableJobs" component={AvailableJobsScreen} />
      <Stack.Screen name="ActiveDeliveries" component={TrackingScreen} />
      <Stack.Screen name="MyEarnings" component={EarningsScreen} />
      <Stack.Screen name="AcceptJobConfirmation" component={AcceptJobConfirmationScreen} />
      <Stack.Screen name="JobAccepted" component={JobAcceptedScreen} />
      <Stack.Screen name="PickupChecklist" component={PickupChecklistScreen} />
      <Stack.Screen name="DeliveryChecklist" component={DeliveryChecklistScreen} />
      <Stack.Screen name="DeliveryCompleted" component={DeliveryCompletedScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;