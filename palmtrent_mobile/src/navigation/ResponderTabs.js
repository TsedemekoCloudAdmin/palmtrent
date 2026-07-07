import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import ResponderPortalScreen from '../screens/emergency/ResponderPortalScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ResponderTabs = () => {
  const insets = useSafeAreaInsets();
  return (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingBottom: 8 + insets.bottom,
        paddingTop: 8,
        height: 60 + insets.bottom,
      },
      tabBarActiveTintColor: '#0C2D48',
      tabBarInactiveTintColor: '#9ca3af',
    }}
  >
    <Tab.Screen
      name="ResponderPortal"
      component={ResponderPortalScreen}
      options={{
        title: 'SOS',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="health-and-safety" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Alerts"
      component={NotificationScreen}
      options={{
        title: 'Alerts',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
      }}
    />
  </Tab.Navigator>
  );
};

export default ResponderTabs;
