// src/screens/BookingFlowManager.js
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

// Import all booking screens
import BookingStartScreen from './BookingStartScreen';
import MultipleVehiclesBooking from './MultipleVehiclesBooking';
import CreateBookingScreen from './shipper/CreateBookingScreen';
import BookingReviewScreen from './BookingReviewScreen';
import BookingConfirmationScreen from './BookingConfirmationScreen';
import CrossBorderBookingScreen from './CrossBorderBookingScreen';
// Payment screens
import MobileMoneyPaymentScreen from './MobileMoneyPaymentScreen';
import CardPaymentScreen from './CardPaymentScreen';
import AgentPaymentScreen from './AgentPaymentScreen';

const BookingFlowManager = ({ navigation, route }) => {
  const [currentScreen, setCurrentScreen] = useState(route.params?.initialScreen || 'booking-start');
  const [bookingData, setBookingData] = useState({
    bookingType: null,
    vehicles: [],
    route: {},
    payment: {},
    trailerRental: null
  });

  const navigateTo = (screen, params = {}) => {
    if (params && Object.keys(params).length > 0) {
      updateBookingData(params);
    }
    setCurrentScreen(screen);
  };

  const updateBookingData = (newData) => {
    setBookingData(prev => ({ ...prev, ...newData }));
  };

  // Function to exit the flow and return to home
  const exitToHome = () => {
    navigation.navigate('Home');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'booking-start':
        return (
          <BookingStartScreen 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      case 'multiple-vehicles':
        return (
          <MultipleVehiclesBooking 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      case 'create-booking':
        return (
          <CreateBookingScreen 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      case 'booking-review':
        return (
          <BookingReviewScreen 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      case 'booking-confirmation':
        return (
          <BookingConfirmationScreen 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      case 'cross-border-booking':
        return (
          <CrossBorderBookingScreen 
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );
      
      // Payment screens - MobileMoneyPaymentScreen handles both EcoCash and OneMoney
      case 'ecocash-payment':
      case 'mobile-money-payment':
        return (
          <MobileMoneyPaymentScreen
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );

      case 'card-payment':
        return (
          <CardPaymentScreen
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );

      case 'agent-payment':
      case 'cash-agent-payment':
        return (
          <AgentPaymentScreen
            onNavigate={navigateTo}
            bookingData={bookingData}
            updateBookingData={updateBookingData}
            onExit={exitToHome}
          />
        );

      default:
        return <BookingStartScreen onNavigate={navigateTo} onExit={exitToHome} />;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
});

export default BookingFlowManager;
