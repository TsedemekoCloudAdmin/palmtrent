import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import SOSButton from '../screens/components/SOSButton';

// Transporter Screens
import HomeScreen from '../screens/HomeScreen';
import AvailableJobsScreen from '../screens/AvailableJobs';
import ProfileScreen from '../screens/ProfileScreen';
import TrackingScreen from '../screens/TrackingScreen';
import PendingJobsScreen from '../screens/transporter/PendingJobsScreen';
import FleetDashboardScreen from '../screens/transporter/FleetDashboardScreen';
import DriverMarketplaceScreen from '../screens/transporter/DriverMarketplaceScreen';

const Tab = createBottomTabNavigator();
const EmergencyTabScreen = () => null;

const TransporterTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          position: 'relative',
        },
        tabBarActiveTintColor: '#0C2D48',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
          title: 'Home',
        }}
      />
      <Tab.Screen 
        name="Jobs" 
        component={AvailableJobsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="work" size={size} color={color} />
          ),
          title: 'Jobs',
        }}
      />
      <Tab.Screen 
        name="Emergency" 
        component={EmergencyTabScreen}
        options={{
          tabBarButton: () => (
            <SOSButton size="small" showLabel={false} style={styles.emergencyButton} />
          ),
          title: '',
        }}
      />
      <Tab.Screen 
        name="Fleet" 
        component={FleetDashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="local-shipping" size={size} color={color} />
          ),
          title: 'Fleet',
        }}
      />
      
      <Tab.Screen 
        name="Drivers" 
        component={DriverMarketplaceScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-search" size={size} color={color} />
          ),
          title: 'Drivers',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  emergencyButton: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default TransporterTabs;
