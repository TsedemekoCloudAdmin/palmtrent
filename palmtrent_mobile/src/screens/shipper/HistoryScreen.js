import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';

const HistoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking History</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.placeholder}>
          <MaterialIcons name="history" size={64} color="#d1d5db" />
          <Text style={styles.placeholderText}>Booking History</Text>
          <Text style={styles.placeholderSubtext}>Your past shipments will appear here</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HistoryScreen;