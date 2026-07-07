import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Extract a CR- reference from raw QR contents (either the reference itself or a
// tracking URL like https://.../track/CR-XXXX).
const extractReference = (raw) => {
  if (!raw) return null;
  const match = String(raw).toUpperCase().match(/CR-[A-Z0-9]+/);
  return match ? match[0] : null;
};

const CourierScanScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const onScan = ({ data }) => {
    if (scanned) return;
    const reference = extractReference(data);
    if (!reference) return;
    setScanned(true);
    navigation.navigate('CourierDetail', { id: reference });
  };

  if (!permission) {
    return <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}><View style={styles.center}><Text style={styles.info}>Checking camera…</Text></View></SafeAreaView>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <View style={styles.center}>
          <MaterialIcons name="photo-camera" size={48} color="#94a3b8" />
          <Text style={styles.info}>We need camera access to scan shipment labels.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Grant access</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13'] }}
        onBarcodeScanned={scanned ? undefined : onScan}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="close" size={28} color="#fff" /></TouchableOpacity>
          <Text style={styles.title}>Scan label</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.frame} />
        <Text style={styles.hint}>Point at the shipment QR code</Text>
        {scanned && (
          <TouchableOpacity style={styles.rescan} onPress={() => setScanned(false)}><Text style={styles.btnText}>Scan again</Text></TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f8fafc' },
  info: { color: '#334155', textAlign: 'center', fontSize: 15 },
  btn: { backgroundColor: '#0C2D48', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '800' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#F37021', borderRadius: 18 },
  hint: { color: '#fff', marginTop: 18, fontSize: 14 },
  rescan: { marginTop: 18, backgroundColor: '#F37021', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }
});

export default CourierScanScreen;
