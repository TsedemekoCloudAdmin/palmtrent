import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import useAuth from './src/hook/useAuth';

const StartupLoadingScreen = () => (
  <View style={styles.startupContainer}>
    <Image
      source={require('./assets/icon.png')}
      style={styles.startupLogo}
      resizeMode="contain"
    />
    <Text style={styles.startupText}>PalmTrent</Text>
  </View>
);

const AuthProgressOverlay = () => (
  <View style={styles.progressOverlay}>
    <View style={styles.progressPanel}>
      <Image
        source={require('./assets/icon.png')}
        style={styles.progressLogo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color="#F37021" />
      <Text style={styles.progressText}>Processing...</Text>
    </View>
  </View>
);

// Component that chooses which navigator to show based on auth state
const Navigation = () => {
  const { user, isLoading, isInitializing } = useAuth();
  
  if (isInitializing) {
    return <StartupLoadingScreen />;
  }
  
  return (
    <View style={styles.appShell}>
      {user ? <AppNavigator /> : <AuthNavigator />}
      {isLoading && <AuthProgressOverlay />}
    </View>
  );
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

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  startupContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 32,
  },
  startupLogo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  startupText: {
    color: '#0C2D48',
    fontSize: 22,
    fontWeight: '800',
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    padding: 24,
  },
  progressPanel: {
    minWidth: 180,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0C2D48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  progressLogo: {
    width: 52,
    height: 52,
  },
  progressText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '700',
  },
});
