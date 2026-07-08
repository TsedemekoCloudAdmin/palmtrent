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
  { id: 'license', label: 'Vehicle License', icon: 'badge', hint: 'Current vehicle license disc' },
  { id: 'roadworthy', label: 'Roadworthy Certificate', icon: 'verified-user', hint: 'Valid roadworthiness certificate' },
  { id: 'permit', label: 'Operating Permit', icon: 'article', hint: 'Route or operating permit (optional)' }
];

const VehicleDocumentsScreen = ({ navigation, route }) => {
  const vehicleId = route.params?.vehicleId;
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) { setLoading(false); return; }
    try {
      setLoading(true);
      const response = await apiService.getVehicle(vehicleId);
      setVehicle(response.data || null);
    } catch (error) {
      console.error('Load vehicle documents error:', error);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => { loadVehicle(); }, [loadVehicle]);

  const existingDoc = (docType) => {
    const docs = vehicle?.documents || {};
    if (docType === 'license') return docs.license?.document ? docs.license : null;
    if (docType === 'roadworthy') return docs.roadworthyCertificate?.document ? docs.roadworthyCertificate : null;
    if (docType === 'permit') return (docs.permits || []).filter(p => p.document);
    return null;
  };

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

      await apiService.addVehicleDocument(vehicleId, { docType: docType.id, url });
      await loadVehicle();
      Alert.alert('Uploaded', `${docType.label} attached. Your vehicle will be reviewed for verification.`);
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

  const renderExisting = (docType) => {
    const existing = existingDoc(docType.id);
    const list = Array.isArray(existing) ? existing : (existing ? [existing] : []);
    return list.map((doc, index) => (
      <TouchableOpacity key={index} style={styles.docRow} onPress={() => doc.document && Linking.openURL(doc.document)}>
        <MaterialIcons name="description" size={18} color="#16a34a" />
        <Text style={styles.docRowText} numberOfLines={1}>
          {doc.number ? `#${doc.number}` : 'Uploaded'}
          {doc.expiryDate ? ` • exp ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}
        </Text>
        <MaterialIcons name="open-in-new" size={16} color="#6b7280" />
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Upload your vehicle's verification documents. An admin reviews them before the
          vehicle can be assigned to jobs.
        </Text>

        {DOC_TYPES.map((docType) => {
          const isUploading = uploadingType === docType.id;
          const existing = existingDoc(docType.id);
          const hasAny = Array.isArray(existing) ? existing.length : Boolean(existing);
          return (
            <View key={docType.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name={docType.icon} size={22} color="#0C2D48" />
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{docType.label}</Text>
                  <Text style={styles.cardHint}>{docType.hint}</Text>
                </View>
              </View>

              {renderExisting(docType)}

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => chooseSource(docType)}
                disabled={isUploading || !vehicleId}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#0C2D48" />
                ) : (
                  <>
                    <MaterialIcons name="upload-file" size={18} color="#0C2D48" />
                    <Text style={styles.uploadButtonText}>
                      {hasAny ? 'Replace / add' : `Upload ${docType.label}`}
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
            <Text style={styles.loadingText}>Loading…</Text>
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

export default VehicleDocumentsScreen;
