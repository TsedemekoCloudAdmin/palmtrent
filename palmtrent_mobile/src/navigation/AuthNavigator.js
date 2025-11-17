// src/navigation/AuthNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

// Import screens
import WelcomeScreen from '../screens/auth/WelcomeScrreen';
import UserTypeScreen from '../screens/auth/UserTypeScreen';
import PhoneVerifyScreen from '../screens/auth/PhoneVerifyScreen';
import RegisterDetailsScreen from '../screens/auth/RegisterDetailsScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="UserType" component={UserTypeScreen} />
      <Stack.Screen name="PhoneVerify" component={PhoneVerifyScreen} />
      <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;