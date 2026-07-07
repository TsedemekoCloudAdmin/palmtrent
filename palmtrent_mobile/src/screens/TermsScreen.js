import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const TermsScreen = ({ navigation }) => {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By accessing or using PalmTrent, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.`
    },
    {
      title: '2. User Accounts',
      content: `• You must be at least 18 years old to create an account
• You are responsible for maintaining the confidentiality of your account
• You must provide accurate and complete information during registration
• You are responsible for all activities that occur under your account
• You must notify us immediately of any unauthorized use of your account`
    },
    {
      title: '3. User Types and Responsibilities',
      content: `Shippers:
• Must provide accurate cargo information
• Must ensure cargo is properly packaged
• Must be available for pickup and delivery coordination
• Must pay for services as agreed

Transporters:
• Must maintain valid licenses and permits
• Must have appropriate insurance coverage
• Must handle cargo with care
• Must complete deliveries in a timely manner
• Must comply with all traffic and transport regulations

Trailer Owners:
• Must ensure trailers are roadworthy
• Must maintain accurate availability information
• Must comply with rental agreements`
    },
    {
      title: '4. Bookings and Payments',
      content: `• All bookings are subject to availability
• Prices are calculated based on distance, cargo type, and vehicle requirements
• Payment must be made through approved payment methods
• Cancellation fees may apply as per our cancellation policy
• Disputes must be raised within 48 hours of delivery completion`
    },
    {
      title: '5. Insurance and Liability',
      content: `• Basic cargo insurance is included with all bookings
• Additional insurance options are available
• PalmTrent is not liable for damages exceeding insurance coverage
• Claims must be filed within 7 days of incident
• Supporting documentation is required for all claims`
    },
    {
      title: '6. Prohibited Activities',
      content: `Users are prohibited from:
• Transporting illegal or prohibited goods
• Providing false or misleading information
• Harassing or threatening other users
• Circumventing the platform for payments
• Using the platform for any unlawful purpose
• Attempting to access other users' accounts
• Interfering with platform operations`
    },
    {
      title: '7. Ratings and Reviews',
      content: `• Users may rate and review each other after completed transactions
• Reviews must be honest and based on actual experiences
• Abusive or false reviews may be removed
• Ratings affect user visibility and opportunities on the platform`
    },
    {
      title: '8. Termination',
      content: `We may terminate or suspend your account immediately, without prior notice, for:
• Violation of these Terms of Service
• Fraudulent or illegal activity
• Repeated poor ratings or complaints
• Any other reason at our discretion

Upon termination, your right to use the platform will immediately cease.`
    },
    {
      title: '9. Limitation of Liability',
      content: `PalmTrent shall not be liable for:
• Indirect, incidental, or consequential damages
• Loss of profits or data
• Damages exceeding the amount paid for the service
• Acts of third parties including transporters and shippers

We provide the platform "as is" without warranties of any kind.`
    },
    {
      title: '10. Governing Law',
      content: `These terms shall be governed by and construed in accordance with the laws of Zimbabwe. Any disputes shall be subject to the exclusive jurisdiction of the courts of Zimbabwe.`
    },
    {
      title: '11. Changes to Terms',
      content: `We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or in-app notification.`
    },
    {
      title: '12. Contact Information',
      content: `For questions about these Terms of Service:
• Email: legal@palmtrent.com
• Phone: +263 242 123 456
• Address: 123 Main Street, Harare, Zimbabwe`
    }
  ];

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0C2D48" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.lastUpdated}>
          <MaterialIcons name="update" size={16} color="#6b7280" />
          <Text style={styles.lastUpdatedText}>Last Updated: January 2025</Text>
        </View>

        <Text style={styles.intro}>
          Please read these Terms of Service carefully before using the PalmTrent transport and logistics platform.
        </Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using PalmTrent, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
  headerSpacer: {
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
    backgroundColor: '#fef3c7',
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

export default TermsScreen;
