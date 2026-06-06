import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import DriverDeliveriesScreen from '../screens/driver/DriverDeliveriesScreen';
import DriverPortalScreen from '../screens/driver/DriverPortalScreen';
import HistoryScreen from '../screens/shipper/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationScreen from '../screens/NotificationScreen';

const Tab = createBottomTabNavigator();

const DriverTabs = () => (
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
      },
      tabBarActiveTintColor: '#0C2D48',
      tabBarInactiveTintColor: '#9ca3af',
    }}
  >
    <Tab.Screen
      name="DriverDeliveries"
      component={DriverDeliveriesScreen}
      options={{
        title: 'Deliveries',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="local-shipping" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="DriverWork"
      component={DriverPortalScreen}
      options={{
        title: 'Work',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Progress"
      component={HistoryScreen}
      options={{
        title: 'Progress',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="timeline" size={size} color={color} />,
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

export default DriverTabs;
