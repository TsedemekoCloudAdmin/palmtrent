import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from '../screens/HomeScreen';
import TrailerListScreen from '../screens/trailerOwner/TrailerListScreen';
import TrailerRentalScreen from '../screens/trailerOwner/TrailerRentalScreen';
import FleetRentalRequestsScreen from '../screens/trailerOwner/FleetRentalRequestsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TrailerOwnerTabs = () => (
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
      name="Home"
      component={HomeScreen}
      options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Fleet"
      component={TrailerListScreen}
      options={{
        title: 'Fleet',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="local-shipping" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Market"
      component={TrailerRentalScreen}
      options={{
        title: 'Market',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="storefront" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Rentals"
      component={FleetRentalRequestsScreen}
      options={{
        title: 'Rentals',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="assignment" size={size} color={color} />,
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

export default TrailerOwnerTabs;
