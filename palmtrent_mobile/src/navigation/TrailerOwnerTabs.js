import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from '../screens/HomeScreen';
import TrailerListScreen from '../screens/trailerOwner/TrailerListScreen';
import TrailerRentalScreen from '../screens/trailerOwner/TrailerRentalScreen';
import FleetRentalRequestsScreen from '../screens/trailerOwner/FleetRentalRequestsScreen';
import RentalStaffScreen from '../screens/trailerOwner/RentalStaffScreen';
import OwnerDriversScreen from '../screens/trailerOwner/OwnerDriversScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TrailerOwnerTabs = () => {
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
      name="Staff"
      component={RentalStaffScreen}
      options={{
        title: 'Staff',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="groups" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Drivers"
      component={OwnerDriversScreen}
      options={{
        title: 'Drivers',
        tabBarIcon: ({ color, size }) => <MaterialIcons name="badge" size={size} color={color} />,
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

export default TrailerOwnerTabs;
