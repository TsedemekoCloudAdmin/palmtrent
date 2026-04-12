import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PrivacyScreen = ({ navigation }) => {
  const sections = [
    {
      title: 'Information We Collect',
      content: `We collect information you provide directly to us, such as:
• Personal information (name, email, phone number)
• Location data for pickup and delivery services
• Payment information for transactions
• Vehicle and driver documentation for transporters
• Communication data between users`
    },
    {
      title: 'How We Use Your Information',
      content: `We use the information we collect to:
• Provide, maintain, and improve our services
• Process transactions and send related information
• Connect shippers with transporters
• Track shipments in real-time
• Send notifications about bookings and deliveries
• Respond to your comments and questions
• Detect and prevent fraudulent activities`
    },
    {
      title: 'Information Sharing',
      content: `We may share your information with:
• Other users as necessary to complete bookings
• Service providers who assist in our operations
• Law enforcement when required by law
• Business partners with your consent

We do not sell your personal information to third parties.`
    },
    {
      title: 'Data Security',
      content: `We implement appropriate security measures to protect your information:
• Encryption of sensitive data
• Secure servers and databases
• Regular security audits
• Access controls and authentication

However, no method of transmission over the Internet is 100% secure.`
    },
    {
      title: 'Your Rights',
      content: `You have the right to:
• Access your personal information
• Correct inaccurate data
• Delete your account and data
• Opt-out of marketing communications
• Export your data

Contact us to exercise these rights.`
    },
    {
      title: 'Location Data',
      content: `We collect location data to:
• Enable real-time shipment tracking
• Match transporters with nearby jobs
• Calculate accurate distances and pricing
• Provide navigation assistance

You can disable location services in your device settings, but this may limit app functionality.`
    },
    {
      title: 'Changes to This Policy',
      content: `We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.`
    },
    {
      title: 'Contact Us',
      content: `If you have questions about this privacy policy, please contact us:
• Email: privacy@palmtrent.com
• Phone: +263 242 123 456
• Address: 123 Main Street, Harare, Zimbabwe`
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0C2D48" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.lastUpdated}>
          <MaterialIcons name="update" size={16} color="#6b7280" />
          <Text style={styles.lastUpdatedText}>Last Updated: January 2025</Text>
        </View>

        <Text style={styles.intro}>
          PalmTrent is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our transport and logistics platform.
        </Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using PalmTrent, you agree to this privacy policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C2D48',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  intro: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 24,
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  footer: {
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PrivacyScreen;
