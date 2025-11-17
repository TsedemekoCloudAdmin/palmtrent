import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export const DisputeScreen = ({ job, onNavigate }) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [desiredOutcome, setDesiredOutcome] = useState('');

  const categories = [
    'Payment issue',
    'Cargo damage',
    'Late delivery',
    'Service quality',
    'Unprofessional conduct',
    'Other'
  ];

  const outcomes = [
    { value: 'full_refund', label: 'Full refund' },
    { value: 'partial_refund', label: 'Partial refund' },
    { value: 'compensation', label: 'Compensation' },
    { value: 'apology', label: 'Apology' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
        <Text style={styles.headerSubtitle}>We'll help resolve this</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Job Info */}
          <View style={styles.jobCard}>
            <Text style={styles.jobLabel}>JOB ID</Text>
            <Text style={styles.jobId}>{job?.id || 'PT-2025-001234'}</Text>
            <Text style={styles.jobRoute}>
              {job?.route?.from} → {job?.route?.to}
            </Text>
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's the issue? *</Text>
            <View style={styles.categoriesContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected
                  ]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextSelected
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Describe the issue *</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide as much detail as possible..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Evidence Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Evidence (Optional)</Text>
            <View style={styles.evidenceGrid}>
              {[1, 2, 3].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.evidenceButton}
                  onPress={() => setEvidence([...evidence, `evidence${n}`])}
                  activeOpacity={0.7}
                >
                  {evidence[n-1] ? (
                    <>
                      <MaterialIcons name="check-circle" size={32} color="#16a34a" />
                      <Text style={styles.evidenceButtonText}>Added</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="camera-alt" size={32} color="#9ca3af" />
                      <Text style={styles.evidenceButtonText}>Photo/Doc</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Upload photos, documents, or screenshots
            </Text>
          </View>

          {/* Desired Outcome */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What outcome do you want? *</Text>
            <View style={styles.outcomesContainer}>
              {outcomes.map((outcome) => (
                <TouchableOpacity
                  key={outcome.value}
                  style={[
                    styles.outcomeButton,
                    desiredOutcome === outcome.value && styles.outcomeButtonSelected
                  ]}
                  onPress={() => setDesiredOutcome(outcome.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.outcomeText,
                    desiredOutcome === outcome.value && styles.outcomeTextSelected
                  ]}>
                    {outcome.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>1. We'll review your dispute within 24 hours</Text>
              <Text style={styles.infoItem}>2. Both parties will be contacted</Text>
              <Text style={styles.infoItem}>3. Mediation call scheduled (48-72 hours)</Text>
              <Text style={styles.infoItem}>4. Resolution target: 5-7 days</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, styles.dangerButton, (!category || !description || !desiredOutcome) && styles.buttonDisabled]}
            onPress={() => onNavigate('dispute-submitted')}
            disabled={!category || !description || !desiredOutcome}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Submit Dispute</Text>
          </TouchableOpacity>
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
    backgroundColor: '#dc2626',
    padding: 24,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  jobCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  jobLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  jobId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  jobRoute: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  categoriesContainer: {
    gap: 8,
  },
  categoryButton: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  categoryButtonSelected: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  categoryText: {
    fontSize: 16,
    color: '#374151',
  },
  categoryTextSelected: {
    color: '#dc2626',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  evidenceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  evidenceButton: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  evidenceButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  outcomesContainer: {
    gap: 8,
  },
  outcomeButton: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  outcomeButtonSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  outcomeText: {
    fontSize: 16,
    color: '#374151',
  },
  outcomeTextSelected: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoList: {
    gap: 4,
  },
  infoItem: {
    fontSize: 14,
    color: '#374151',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DisputeScreen;