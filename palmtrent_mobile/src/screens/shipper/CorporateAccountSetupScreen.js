import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CustomSelect from '../components/CustomSelect';
import apiService from '../../services/apiService';
import useAuth from '../../hook/useAuth';

const CorporateAccountSetupScreen = ({ navigation }) => {
  const { updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [formData, setFormData] = useState({
    companyName: '',
    registrationNumber: '',
    taxNumber: '',
    monthlyVolume: '',
    industry: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: ''
  });

  // Options for dropdowns
  const industryOptions = [
    { label: 'Manufacturing', value: 'manufacturing' },
    { label: 'Retail & Wholesale', value: 'retail' },
    { label: 'Agriculture', value: 'agriculture' },
    { label: 'Mining', value: 'mining' },
    { label: 'Construction', value: 'construction' },
    { label: 'Logistics & Transport', value: 'logistics' },
    { label: 'FMCG', value: 'fmcg' },
    { label: 'Pharmaceutical', value: 'pharmaceutical' },
    { label: 'Other', value: 'other' }
  ];

  const volumeOptions = [
    { label: '10-50 shipments per month', value: '10-50' },
    { label: '50-100 shipments per month', value: '50-100' },
    { label: '100-200 shipments per month', value: '100-200' },
    { label: '200-500 shipments per month', value: '200-500' },
    { label: '500+ shipments per month', value: '500+' }
  ];

  const navigateTo = (screen) => {
    if (navigation) {
      navigation.navigate(screen);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validation for each step
  const isStep1Valid = () => {
    return formData.companyName && 
           formData.registrationNumber && 
           formData.taxNumber && 
           formData.industry && 
           formData.monthlyVolume;
  };

  const isStep2Valid = () => {
    return formData.contactPerson &&
           formData.contactEmail &&
           formData.contactPhone;
  };

  // Map volume to company size for backend
  const getCompanySize = (volume) => {
    const volumeMap = {
      '10-50': '1-10',
      '50-100': '11-50',
      '100-200': '51-200',
      '200-500': '201-500',
      '500+': '500+'
    };
    return volumeMap[volume] || '11-50';
  };

  // Get payment terms based on selected plan
  const getPaymentTerms = (plan) => {
    const termsMap = {
      'standard': 'net_30',
      'premium': 'net_30',
      'enterprise': 'net_30'
    };
    return termsMap[plan] || 'prepaid';
  };

  // Submit corporate account application
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        companyName: formData.companyName,
        registrationNumber: formData.registrationNumber,
        taxNumber: formData.taxNumber,
        industry: formData.industry,
        companySize: getCompanySize(formData.monthlyVolume),
        contactPerson: {
          name: formData.contactPerson,
          email: formData.contactEmail,
          phone: formData.contactPhone
        },
        billing: {
          paymentTerms: getPaymentTerms(selectedPlan),
          plan: selectedPlan
        }
      };

      const response = await apiService.registerCorporateAccount(payload);

      if (response.success) {
        // Update local user data if updateUser is available
        if (updateUser) {
          updateUser({
            userType: 'corporate',
            accountType: 'corporate',
            corporateAccount: response.data?._id,
            companyName: response.data?.companyName || formData.companyName
          });
        }

        Alert.alert(
          'Application Submitted',
          'Your corporate account application has been submitted for review. You will be notified once approved.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Corporate registration error:', error);
      const errorMessage = error.message || 'Failed to submit application. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigateTo('Home')}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Corporate Account</Text>
        <Text style={styles.headerSubtitle}>Step {step} of 3</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map(s => (
            <View 
              key={s}
              style={[
                styles.progressStep,
                s <= step ? styles.progressStepActive : styles.progressStepInactive
              ]} 
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Company Information</Text>
              
              {/* Company Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ABC Manufacturing Ltd"
                  value={formData.companyName}
                  onChangeText={(value) => updateField('companyName', value)}
                />
              </View>

              {/* Registration Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Registration Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456/78"
                  value={formData.registrationNumber}
                  onChangeText={(value) => updateField('registrationNumber', value)}
                />
              </View>

              {/* Tax Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tax Identification Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ZIMRA Tax Number"
                  value={formData.taxNumber}
                  onChangeText={(value) => updateField('taxNumber', value)}
                />
              </View>

              {/* Industry */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Industry *</Text>
                <CustomSelect
                  options={industryOptions}
                  value={formData.industry}
                  onValueChange={(value) => updateField('industry', value)}
                  placeholder="Select industry"
                />
              </View>

              {/* Monthly Volume */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Expected Monthly Volume *</Text>
                <CustomSelect
                  options={volumeOptions}
                  value={formData.monthlyVolume}
                  onValueChange={(value) => updateField('monthlyVolume', value)}
                  placeholder="Select expected volume"
                />
              </View>

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <MaterialIcons name="info" size={20} color="#0C2D48" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Why we need this information?</Text>
                  <Text style={styles.infoText}>
                    This helps us customize your corporate account features, pricing, and support based on your business needs and volume.
                  </Text>
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Contact Person</Text>
              
              {/* Contact Person */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Moyo"
                  value={formData.contactPerson}
                  onChangeText={(value) => updateField('contactPerson', value)}
                />
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@abcmfg.co.zw"
                  value={formData.contactEmail}
                  onChangeText={(value) => updateField('contactEmail', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Phone */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+263 77 123 4567"
                  value={formData.contactPhone}
                  onChangeText={(value) => updateField('contactPhone', value)}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Documents Required */}
              <View style={styles.documentsBanner}>
                <Text style={styles.documentsTitle}>Documents Required</Text>
                <View style={styles.documentsList}>
                  <DocumentItem text="Certificate of Incorporation" />
                  <DocumentItem text="CR14 (Directors List)" />
                  <DocumentItem text="Tax Clearance Certificate" />
                  <DocumentItem text="Bank Reference Letter" />
                  <DocumentItem text="3 Trade References" />
                </View>
                <Text style={styles.documentsNote}>
                  These documents will be required during the verification process. You can upload them after submitting your application.
                </Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Choose Your Plan</Text>

              <CorporatePlanCard
                title="Standard"
                planKey="standard"
                volume="50-100 shipments/month"
                price="10%"
                features={[
                  'Net 30 payment terms',
                  'Volume discount',
                  'Multi-user access',
                  'Monthly reporting',
                  'Email support'
                ]}
                selected={selectedPlan === 'standard'}
                onSelect={() => setSelectedPlan('standard')}
              />

              <CorporatePlanCard
                title="Premium"
                planKey="premium"
                volume="100-200 shipments/month"
                price="8%"
                features={[
                  'Net 60 payment terms',
                  'Enhanced volume discount',
                  'Multi-user access',
                  'Advanced analytics',
                  'Dedicated account manager',
                  'Priority support',
                  'API access'
                ]}
                recommended
                selected={selectedPlan === 'premium'}
                onSelect={() => setSelectedPlan('premium')}
              />

              <CorporatePlanCard
                title="Enterprise"
                planKey="enterprise"
                volume="200+ shipments/month"
                price="Custom"
                features={[
                  'Net 90 payment terms',
                  'Maximum volume discount',
                  'Unlimited users',
                  'Full API integration',
                  'Custom SLAs',
                  '24/7 support',
                  'Quarterly business reviews'
                ]}
                selected={selectedPlan === 'enterprise'}
                onSelect={() => setSelectedPlan('enterprise')}
              />

              <View style={styles.planInfo}>
                <Text style={styles.planInfoText}>
                  💡 Commission rates are based on shipment value. Contact us for enterprise custom pricing.
                </Text>
              </View>
            </>
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.actionButtons}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButtonAction}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonActionText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.continueButton,
              ((step === 1 && !isStep1Valid()) ||
              (step === 2 && !isStep2Valid()) ||
              loading)
                ? styles.continueButtonDisabled : null
            ]}
            onPress={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSubmit();
              }
            }}
            disabled={
              (step === 1 && !isStep1Valid()) ||
              (step === 2 && !isStep2Valid()) ||
              loading
            }
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>
                {step < 3 ? 'Continue' : 'Submit Application'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Document Item Component
const DocumentItem = ({ text }) => (
  <View style={styles.documentItem}>
    <MaterialIcons name="check-circle" size={16} color="#16a34a" />
    <Text style={styles.documentItemText}>{text}</Text>
  </View>
);

// Corporate Plan Card Component
const CorporatePlanCard = ({ title, volume, price, features, recommended, selected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.planCard,
      recommended && styles.planCardRecommended,
      selected && styles.planCardSelected
    ]}
    onPress={onSelect}
    activeOpacity={0.8}
  >
    {recommended && (
      <View style={styles.recommendedBadge}>
        <MaterialIcons name="star" size={16} color="white" />
        <Text style={styles.recommendedText}>Recommended</Text>
      </View>
    )}

    {selected && (
      <View style={styles.selectedIndicator}>
        <MaterialIcons name="check-circle" size={24} color="#16a34a" />
      </View>
    )}

    <View style={styles.planHeader}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planVolume}>{volume}</Text>
    </View>

    <View style={styles.planPrice}>
      <Text style={styles.priceText}>{price}</Text>
      {price !== 'Custom' && <Text style={styles.priceUnit}>commission</Text>}
    </View>

    <View style={styles.featuresList}>
      {features.map((feature, index) => (
        <View key={index} style={styles.featureItem}>
          <MaterialIcons name="check-circle" size={16} color="#F37021" />
          <Text style={styles.featureText}>{feature}</Text>
        </View>
      ))}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#60a5fa',
  },
  progressStepInactive: {
    backgroundColor: '#1e4d7a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  infoBanner: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  documentsBanner: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  documentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 12,
  },
  documentsList: {
    gap: 8,
    marginBottom: 12,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  documentsNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    position: 'relative',
  },
  planCardRecommended: {
    borderColor: '#F37021',
    backgroundColor: '#fff7ed',
  },
  planCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#F37021',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  planVolume: {
    fontSize: 14,
    color: '#6b7280',
  },
  planPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 20,
  },
  priceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  priceUnit: {
    fontSize: 14,
    color: '#6b7280',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  planInfo: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  planInfoText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButtonAction: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CorporateAccountSetupScreen;
