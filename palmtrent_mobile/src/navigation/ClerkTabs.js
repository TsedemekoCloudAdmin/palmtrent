import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import CourierShipmentsScreen from '../screens/courier/CourierShipmentsScreen';
import CourierArrivalsScreen from '../screens/courier/CourierArrivalsScreen';
import CourierScanScreen from '../screens/courier/CourierScanScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Tab bar for PalmTrent depot agents (clerks): their day revolves around the
// courier desk and scanning labels.
const ClerkTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingBottom: 8, paddingTop: 8, height: 60 },
      tabBarActiveTintColor: '#0C2D48',
      tabBarInactiveTintColor: '#9ca3af'
    }}
  >
    <Tab.Screen
      name="Desk"
      component={CourierShipmentsScreen}
      options={{ title: 'Desk', tabBarIcon: ({ color, size }) => <MaterialIcons name="point-of-sale" size={size} color={color} /> }}
    />
    <Tab.Screen
      name="Arrivals"
      component={CourierArrivalsScreen}
      options={{ title: 'Arrivals', tabBarIcon: ({ color, size }) => <MaterialIcons name="call-received" size={size} color={color} /> }}
    />
    <Tab.Screen
      name="Scan"
      component={CourierScanScreen}
      options={{ title: 'Scan', tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-scanner" size={size} color={color} /> }}
    />
    <Tab.Screen
      name="ClerkProfile"
      component={ProfileScreen}
      options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} /> }}
    />
  </Tab.Navigator>
);

export default ClerkTabs;
