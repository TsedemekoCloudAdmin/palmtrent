import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Transporter Screens
import HomeScreen from '../screens/HomeScreen';
import AvailableJobsScreen from '../screens/AvailableJobs';
import ProfileScreen from '../screens/ProfileScreen';
import TrackingScreen from '../screens/TrackingScreen';
import PendingJobsScreen from '../screens/transporter/PendingJobsScreen';

const Tab = createBottomTabNavigator();

// Custom Emergency Button Component
const EmergencyButton = ({ onPress }) => (
  <TouchableOpacity
    style={styles.emergencyButton}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.emergencyButtonInner}>
      <MaterialIcons name="warning" size={24} color="white" />
    </View>
  </TouchableOpacity>
);

const TransporterTabs = () => {
  const handleEmergency = () => {
    // Handle emergency action
    console.log('Emergency button pressed');
  };

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
        component={View} // Dummy component
        options={{
          tabBarButton: () => (
            <EmergencyButton onPress={handleEmergency} />
          ),
          title: '',
        }}
      />
      <Tab.Screen 
        name="InTransit" 
        component={TrackingScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="local-shipping" size={size} color={color} />
          ),
          title: 'In Transit',
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
  emergencyButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
});

export default TransporterTabs;