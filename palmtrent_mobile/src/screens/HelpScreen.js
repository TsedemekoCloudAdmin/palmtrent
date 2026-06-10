import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar, TextInput
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { helpSections, PLATFORMS } from '../data/helpContent';

// In-app user guide for the mobile app. Shows the full platform guide with a
// Web/Mobile/All filter (defaults to Mobile) and search.
const HelpScreen = ({ navigation }) => {
  const [platform, setPlatform] = useState('mobile');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState('getting-started');

  const q = query.trim().toLowerCase();

  const sections = useMemo(() => {
    return helpSections
      .map((section) => {
        const flows = section.flows.filter((f) => {
          const platformOk = platform === 'all' || f.platforms.includes(platform);
          if (!platformOk) return false;
          if (!q) return true;
          const hay = `${section.title} ${f.title} ${f.steps.join(' ')} ${f.result}`.toLowerCase();
          return hay.includes(q);
        });
        return { ...section, flows };
      })
      .filter((s) => s.flows.length > 0);
  }, [platform, q]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Help & User Guide</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.controls}>
        <View style={styles.toggle}>
          {['mobile', 'web', 'all'].map((p) => (
            <TouchableOpacity key={p} style={[styles.toggleBtn, platform === p && styles.toggleBtnActive]} onPress={() => setPlatform(p)}>
              <Text style={[styles.toggleText, platform === p && styles.toggleTextActive]}>{p === 'all' ? 'All' : PLATFORMS[p]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput style={styles.search} placeholder="Search the guide…" value={query} onChangeText={setQuery} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sections.length === 0 && <Text style={styles.empty}>No topics match your search.</Text>}
        {sections.map((section) => {
          const open = openId === section.id;
          return (
            <View key={section.id} style={styles.section}>
              <TouchableOpacity style={styles.sectionHead} onPress={() => setOpenId(open ? null : section.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSummary}>{section.summary}</Text>
                </View>
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={26} color="#0C2D48" />
              </TouchableOpacity>

              {open && section.flows.map((flow) => (
                <View key={flow.title} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.flowTitle}>{flow.title}</Text>
                    <View style={styles.chips}>
                      {flow.platforms.map((p) => (
                        <View key={p} style={[styles.chip, p === 'web' ? styles.chipWeb : styles.chipMobile]}>
                          <Text style={[styles.chipText, p === 'web' ? styles.chipTextWeb : styles.chipTextMobile]}>{PLATFORMS[p]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {flow.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.stepNum}>{i + 1}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                  <View style={styles.result}>
                    <Text style={styles.resultLabel}>✓ End result</Text>
                    <Text style={styles.resultText}>{flow.result}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  controls: { backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  toggle: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', padding: 4, borderRadius: 10 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  toggleTextActive: { color: '#0C2D48' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12 },
  search: { flex: 1, minHeight: 42, color: '#0f172a' },
  content: { padding: 16 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 30 },
  section: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0C2D48' },
  sectionSummary: { fontSize: 12, color: '#64748b', marginTop: 2 },
  card: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  flowTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipWeb: { backgroundColor: '#dbeafe' },
  chipMobile: { backgroundColor: '#fef3c7' },
  chipText: { fontSize: 10, fontWeight: '800' },
  chipTextWeb: { color: '#1e40af' },
  chipTextMobile: { color: '#92400e' },
  stepRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0C2D48', color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: '800', overflow: 'hidden', lineHeight: 20 },
  stepText: { flex: 1, color: '#334155', fontSize: 13, lineHeight: 19 },
  result: { marginTop: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 10 },
  resultLabel: { color: '#15803d', fontWeight: '800', fontSize: 11, marginBottom: 2 },
  resultText: { color: '#166534', fontSize: 13, lineHeight: 18 }
});

export default HelpScreen;
