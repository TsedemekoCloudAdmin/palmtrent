// src/screens/WelcomeScreen.js
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const WelcomeScreen = ({ navigation }) => {  // Changed from onNavigate to navigation
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="local-shipping" size={48} color="#0C2D48" />
          </View>
          <Text style={styles.title}>PalmTrent</Text>
          <Text style={styles.subtitle}>Zimbabwe's #1 Logistics Marketplace</Text>
          <Text style={styles.description}>
            Connect with verified transporters or find loads for your truck
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('UserType')}  // Updated to use navigation.navigate
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}  // Updated to use navigation.navigate
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Safe • Verified • Trusted</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Your existing styles remain the same...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C2D48',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 96,
    height: 96,
    backgroundColor: 'white',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: 'white',
    opacity: 0.9,
    marginBottom: 4,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: 'white',
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  buttonsContainer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#0C2D48',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#F37021',
    borderWidth: 2,
    borderColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  footerText: {
    color: 'white',
    opacity: 0.75,
    fontSize: 14,
  },
});

export default WelcomeScreen;