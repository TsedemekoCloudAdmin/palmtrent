import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../../services/apiService';

const DOC_TYPES = [
  { id: 'purchase_order', label: 'Purchase Order', icon: 'shopping-cart', hint: 'Confirms the customer order' },
  { id: 'delivery_note', label: 'Delivery Note', icon: 'local-shipping', hint: 'Lists items, quantities, and units' },
  { id: 'grv', label: 'Goods Received Voucher', icon: 'assignment-turned-in', hint: 'Acknowledges receipt of goods' }
];

const labelForType = (type) => (DOC_TYPES.find(d => d.id === type)?.label || String(type || 'Document').replace(/_/g, ' '));

const BusinessDocumentsScreen = ({ navigation, route }) => {
  const bookingId = route.params?.bookingId;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);

  const loadDocuments = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiService.getBookingDocuments(bookingId);
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Load documents error:', error);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const pickAndUpload = async (docType, fromCamera) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to capture or select the document.');
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploadingType(docType.id);

      const fileName = asset.fileName || `${docType.id}-${Date.now()}.jpg`;
      const uploadRes = await apiService.uploadFile(asset.uri, fileName, asset.mimeType || 'image/jpeg');
      const url = uploadRes.data?.url || uploadRes.data?.path;
      if (!url) throw new Error('Upload did not return a file URL.');

      await apiService.addBookingDocument(bookingId, { type: docType.id, name: docType.label, url });
      await loadDocuments();
      Alert.alert('Uploaded', `${docType.label} attached to this booking.`);
    } catch (error) {
      Alert.alert('Upload failed', error.message || 'Unable to upload the document.');
    } finally {
      setUploadingType(null);
    }
  };

  const chooseSource = (docType) => {
    Alert.alert(docType.label, 'Add this document', [
      { text: 'Take Photo', onPress: () => pickAndUpload(docType, true) },
      { text: 'Choose from Gallery', onPress: () => pickAndUpload(docType, false) },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Attach compliance documents to this booking. Photograph or select a file for each type.
        </Text>

        {DOC_TYPES.map((docType) => {
          const existing = documents.filter(d => d.type === docType.id);
          const isUploading = uploadingType === docType.id;
          return (
            <View key={docType.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name={docType.icon} size={22} color="#0C2D48" />
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{docType.label}</Text>
                  <Text style={styles.cardHint}>{docType.hint}</Text>
                </View>
              </View>

              {existing.map((doc, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.docRow}
                  onPress={() => doc.url && Linking.openURL(doc.url)}
                >
                  <MaterialIcons name="description" size={18} color="#16a34a" />
                  <Text style={styles.docRowText} numberOfLines={1}>
                    {doc.name || labelForType(doc.type)}
                    {doc.uploadedAt ? ` • ${new Date(doc.uploadedAt).toLocaleDateString()}` : ''}
                  </Text>
                  <MaterialIcons name="open-in-new" size={16} color="#6b7280" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => chooseSource(docType)}
                disabled={isUploading || !bookingId}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#0C2D48" />
                ) : (
                  <>
                    <MaterialIcons name="upload-file" size={18} color="#0C2D48" />
                    <Text style={styles.uploadButtonText}>
                      {existing.length ? 'Add another' : `Upload ${docType.label}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0C2D48" />
            <Text style={styles.loadingText}>Loading documents…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#0C2D48',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  intro: { color: '#6b7280', fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
  },
  docRowText: { flex: 1, fontSize: 13, color: '#166534' },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#0C2D48',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
  },
  uploadButtonText: { color: '#0C2D48', fontWeight: '600', fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  loadingText: { color: '#6b7280', fontSize: 13 },
});

export default BusinessDocumentsScreen;
