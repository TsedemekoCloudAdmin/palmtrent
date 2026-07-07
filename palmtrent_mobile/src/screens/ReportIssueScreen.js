import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';

const ReportIssueScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { bookingId, type = 'general' } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState('');

  const issueCategories = [
    { id: 'cargo_damage', label: 'Cargo Damage', icon: 'report-problem', color: '#ef4444' },
    { id: 'late_delivery', label: 'Delivery Delay', icon: 'schedule', color: '#f59e0b' },
    { id: 'payment_issue', label: 'Payment Issue', icon: 'payment', color: '#3b82f6' },
    { id: 'unprofessional_conduct', label: 'Driver Conduct', icon: 'person', color: '#8b5cf6' },
    { id: 'cargo_missing', label: 'Missing Items', icon: 'inventory', color: '#ec4899' },
    { id: 'other', label: 'Other Issue', icon: 'help-outline', color: '#6b7280' }
  ];

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select an issue category');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please describe your issue');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/claims', {
        bookingId,
        category: selectedCategory,
        issueType: selectedCategory,
        description: description.trim(),
        reportedBy: user?._id
      });

      if (response.success) {
        Alert.alert(
          'Issue Reported',
          'Your issue has been submitted. Our support team will review it and get back to you within 24-48 hours.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error reporting issue:', error);
      Alert.alert('Error', 'Failed to submit issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={24} color="#3b82f6" />
            <Text style={styles.infoText}>
              Select the type of issue you're experiencing and provide details.
              Our support team will review and respond within 24-48 hours.
            </Text>
          </View>

          {/* Issue Categories */}
          <Text style={styles.sectionTitle}>What's the issue?</Text>
          <View style={styles.categoriesGrid}>
            {issueCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  selectedCategory === category.id && styles.categoryCardSelected,
                  selectedCategory === category.id && { borderColor: category.color }
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                  <MaterialIcons name={category.icon} size={24} color={category.color} />
                </View>
                <Text style={[
                  styles.categoryLabel,
                  selectedCategory === category.id && { color: category.color, fontWeight: '600' }
                ]}>
                  {category.label}
                </Text>
                {selectedCategory === category.id && (
                  <View style={[styles.checkMark, { backgroundColor: category.color }]}>
                    <MaterialIcons name="check" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>Describe the issue</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please provide details about the issue you're experiencing..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500 characters</Text>

          {/* Booking Reference */}
          {bookingId && (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceLabel}>Booking Reference</Text>
              <Text style={styles.referenceValue}>{bookingId}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="white" />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 45,
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  categoryCardSelected: {
    backgroundColor: '#fafafa',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 24,
  },
  referenceCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  referenceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    fontFamily: 'monospace',
  },
  bottomActions: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReportIssueScreen;
