import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const JobAcceptedScreen = ({ navigation, route }) => {
  const { job } = route.params || {};

  const jobData = job;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      {navigation.canGoBack?.() ? (
        <TouchableOpacity style={styles.topBackButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color="#0C2D48" />
          <Text style={styles.topBackText}>Back</Text>
        </TouchableOpacity>
      ) : null}
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <MaterialIcons name="check-circle" size={80} color="#16a34a" />
        </View>

        {/* Success Message */}
        <Text style={styles.successTitle}>Job Accepted!</Text>
        <Text style={styles.successSubtitle}>
          The shipper has been notified. You'll receive pickup reminders before the scheduled time.
        </Text>

        {/* Next Steps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Steps</Text>
          <View style={styles.nextSteps}>
            <NextStepItem 
              icon="📱"
              text="Shipper contact details shared"
              action="Call shipper 1 hour before pickup"
            />
            <NextStepItem 
              icon="⏰"
              text={`Pickup ${jobData?.pickup?.date || jobData?.route?.pickup?.date || 'scheduled date'}`}
              action="Be on time for good rating"
            />
            <NextStepItem 
              icon="📍"
              text="Route navigation ready"
              action={jobData?.route?.distance ? `${jobData.route.distance} km` : 'Open the job details for route information'}
            />
            <NextStepItem 
              icon="💰"
              text={`$${jobData?.earnings || jobData?.pricing?.totals?.transporterTotal || 0} expected earnings`}
              action="Released 24 hrs after delivery"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('JobDetails', { job: jobData, jobId: jobData?._id || jobData?.id })}
          >
            <Text style={styles.primaryButtonText}>View Job Details</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Next Step Item Component
const NextStepItem = ({ icon, text, action }) => (
  <View style={styles.nextStepItem}>
    <Text style={styles.nextStepIcon}>{icon}</Text>
    <View style={styles.nextStepContent}>
      <Text style={styles.nextStepText}>{text}</Text>
      <Text style={styles.nextStepAction}>{action}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  topBackButton: {
    position: 'absolute',
    top: 48,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  topBackText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 300,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  nextSteps: {
    gap: 16,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nextStepIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  nextStepAction: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

export default JobAcceptedScreen;
