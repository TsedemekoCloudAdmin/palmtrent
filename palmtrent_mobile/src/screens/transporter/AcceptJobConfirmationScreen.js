import React, { useState } from 'react';
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

const AcceptJobConfirmationScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [checklist, setChecklist] = useState({
    documents: false,
    vehicle: false,
    availability: false,
    route: false
  });

  const allChecked = Object.values(checklist).every(v => v);

  const jobData = job || {
    id: 'PT-2025-001234',
    route: { from: 'Harare', to: 'Bulawayo' },
    earnings: 400,
    pickup: { date: 'Tomorrow', time: '6-12 PM' }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Accept Job</Text>
          <Text style={styles.headerSubtitle}>Confirm you're ready</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Job Summary */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Job Summary</Text>
            <View style={styles.summaryList}>
              <DetailRow label="Route" value={`${jobData.route.from} → ${jobData.route.to}`} />
              <DetailRow label="Pickup" value={`${jobData.pickup.date}, ${jobData.pickup.time}`} />
              <DetailRow label="Earnings" value={`$${jobData.earnings}`} highlight />
            </View>
          </View>
        </View>

        {/* Pre-Acceptance Checklist */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pre-Acceptance Checklist</Text>
            <View style={styles.checklist}>
              <ChecklistItem
                checked={checklist.documents}
                onChange={(val) => setChecklist({...checklist, documents: val})}
                label="All documents are valid and current"
                sublabel="License, VID, ZINARA, Insurance"
              />
              <ChecklistItem
                checked={checklist.vehicle}
                onChange={(val) => setChecklist({...checklist, vehicle: val})}
                label="Vehicle is roadworthy and fueled"
                sublabel="Sufficient fuel for 440 km journey"
              />
              <ChecklistItem
                checked={checklist.availability}
                onChange={(val) => setChecklist({...checklist, availability: val})}
                label="I'm available for pickup tomorrow"
                sublabel="6:00 AM - 12:00 PM window"
              />
              <ChecklistItem
                checked={checklist.route}
                onChange={(val) => setChecklist({...checklist, route: val})}
                label="I understand the route and requirements"
                sublabel="Covered load, handle with care"
              />
            </View>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.section}>
          <View style={styles.termsCard}>
            <MaterialIcons name="warning" size={20} color="#92400e" />
            <Text style={styles.termsText}>
              By accepting, you commit to this job. Cancellations may affect your rating and future opportunities.
            </Text>
          </View>
        </View>

        {/* Confirm Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.confirmButton, !allChecked && styles.confirmButtonDisabled]}
            onPress={() => navigation.navigate('JobAccepted', { job: jobData })}
            disabled={!allChecked}
          >
            <Text style={styles.confirmButtonText}>Confirm & Accept Job</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Checklist Item Component
const ChecklistItem = ({ checked, onChange, label, sublabel }) => (
  <TouchableOpacity 
    style={[styles.checklistItem, checked && styles.checklistItemChecked]}
    onPress={() => onChange(!checked)}
    activeOpacity={0.7}
  >
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <MaterialIcons name="check" size={16} color="white" />}
    </View>
    <View style={styles.checklistContent}>
      <Text style={styles.checklistLabel}>{label}</Text>
      <Text style={styles.checklistSublabel}>{sublabel}</Text>
    </View>
  </TouchableOpacity>
);

// Detail Row Component
const DetailRow = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
      {value}
    </Text>
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
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  summaryList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  detailValueHighlight: {
    color: '#16a34a',
    fontWeight: '600',
  },
  checklist: {
    gap: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    gap: 12,
  },
  checklistItemChecked: {
    backgroundColor: '#f0fdf4',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  checklistContent: {
    flex: 1,
  },
  checklistLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  checklistSublabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  confirmButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 20,
  },
});

export default AcceptJobConfirmationScreen;