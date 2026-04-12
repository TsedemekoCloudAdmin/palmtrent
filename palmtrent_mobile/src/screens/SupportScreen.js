import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const SupportScreen = ({ navigation }) => {
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [message, setMessage] = useState('');

  const contactOptions = [
    {
      icon: 'phone',
      title: 'Call Us',
      subtitle: '+263 242 123 456',
      color: '#16a34a',
      action: () => Linking.openURL('tel:+263242123456'),
    },
    {
      icon: 'email',
      title: 'Email Support',
      subtitle: 'support@palmtrent.com',
      color: '#0C2D48',
      action: () => Linking.openURL('mailto:support@palmtrent.com'),
    },
    {
      icon: 'chat',
      title: 'WhatsApp',
      subtitle: '+263 77 123 4567',
      color: '#25D366',
      action: () => Linking.openURL('https://wa.me/263771234567'),
    },
  ];

  const faqs = [
    {
      question: 'How do I create a booking?',
      answer: 'To create a booking, tap the "Create Booking" button on the home screen. Enter your pickup and delivery locations, select cargo type and vehicle, choose your preferred options, and confirm your booking.',
    },
    {
      question: 'How do I track my shipment?',
      answer: 'You can track your shipment from the home screen by tapping "Track Shipment" or from the booking details page. Real-time GPS tracking is available once the transporter has accepted your booking.',
    },
    {
      question: 'How do I become a transporter?',
      answer: 'To become a transporter, go to Profile > Become a Transporter. You\'ll need to submit your driver\'s license, vehicle registration, and proof of insurance for verification. The process typically takes 24-48 hours.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept EcoCash, OneMoney, bank transfers, and card payments. You can manage your payment methods in Profile > Payment Methods.',
    },
    {
      question: 'How do I cancel a booking?',
      answer: 'You can cancel a booking from the booking details page if the transporter hasn\'t started the pickup. Cancellation fees may apply depending on timing. Check our cancellation policy for details.',
    },
    {
      question: 'How do I file a dispute?',
      answer: 'If you have an issue with a delivery, go to the completed booking and tap "Report Issue". Provide details and any supporting photos. Our team will review and respond within 24 hours.',
    },
    {
      question: 'How are prices calculated?',
      answer: 'Prices are based on distance, cargo type, vehicle type, and any additional services (insurance, express delivery, etc.). You\'ll see a price breakdown before confirming your booking.',
    },
    {
      question: 'Is my cargo insured?',
      answer: 'Basic cargo insurance is included with all bookings. You can add additional coverage during the booking process for high-value items.',
    },
  ];

  const handleSendMessage = () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }
    Alert.alert(
      'Message Sent',
      'Thank you for contacting us. We\'ll respond within 24 hours.',
      [{ text: 'OK', onPress: () => setMessage('') }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0C2D48" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Options */}
        <Text style={styles.sectionLabel}>Contact Us</Text>
        <View style={styles.contactGrid}>
          {contactOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.contactCard}
              onPress={option.action}
            >
              <View style={[styles.contactIcon, { backgroundColor: option.color + '20' }]}>
                <MaterialIcons name={option.icon} size={24} color={option.color} />
              </View>
              <Text style={styles.contactTitle}>{option.title}</Text>
              <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs */}
        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        <View style={styles.faqContainer}>
          {faqs.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <MaterialIcons
                  name={expandedFaq === index ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={24}
                  color="#6b7280"
                />
              </View>
              {expandedFaq === index && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Send Message */}
        <Text style={styles.sectionLabel}>Send Us a Message</Text>
        <View style={styles.messageCard}>
          <TextInput
            style={styles.messageInput}
            placeholder="Describe your issue or question..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
          >
            <MaterialIcons name="send" size={20} color="white" />
            <Text style={styles.sendButtonText}>Send Message</Text>
          </TouchableOpacity>
        </View>

        {/* Support Hours */}
        <View style={styles.hoursCard}>
          <MaterialIcons name="access-time" size={24} color="#F37021" />
          <View style={styles.hoursContent}>
            <Text style={styles.hoursTitle}>Support Hours</Text>
            <Text style={styles.hoursText}>Monday - Friday: 8:00 AM - 6:00 PM</Text>
            <Text style={styles.hoursText}>Saturday: 9:00 AM - 1:00 PM</Text>
            <Text style={styles.hoursText}>Sunday: Closed</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  contactGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  contactCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  faqContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  faqItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 12,
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    minHeight: 100,
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#0C2D48',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  hoursCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  hoursContent: {
    marginLeft: 12,
    flex: 1,
  },
  hoursTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F37021',
    marginBottom: 4,
  },
  hoursText: {
    fontSize: 13,
    color: '#92400e',
    marginTop: 2,
  },
});

export default SupportScreen;
