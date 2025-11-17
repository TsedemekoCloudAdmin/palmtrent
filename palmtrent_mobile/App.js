// App.js - FIXED VERSION
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import useAuth from './src/hook/useAuth'; // Remove curly braces - it's a default export

// Component that chooses which navigator to show based on auth state
const Navigation = () => {
  const { user } = useAuth();
  
  return user ? <AppNavigator /> : <AuthNavigator />;
};

// Main App Component
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}