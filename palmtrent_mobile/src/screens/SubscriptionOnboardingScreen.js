import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';

const POST_REGISTRATION_SUBSCRIPTION_KEY = 'postRegistrationSubscriptionPrompt';

const SubscriptionOnboardingScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectingPlanId, setSelectingPlanId] = useState(null);

  const finish = useCallback(async () => {
    await AsyncStorage.removeItem(POST_REGISTRATION_SUBSCRIPTION_KEY);
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }]
    });
  }, [navigation]);

  const loadSubscriptionOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResponse, subscriptionResponse] = await Promise.all([
        apiService.getPublicPlans(user?.userType),
        apiService.getMySubscription()
      ]);
      setPlans(plansResponse.data || []);
      setSubscription(subscriptionResponse.data || null);
    } catch (error) {
      Alert.alert('Subscriptions unavailable', error.message || 'Unable to load subscription options right now.');
    } finally {
      setLoading(false);
    }
  }, [user?.userType]);

  useEffect(() => {
    loadSubscriptionOptions();
  }, [loadSubscriptionOptions]);

  const selectPlan = async (plan) => {
    const planId = plan.id || plan._id || plan.code;
    setSelectingPlanId(planId);
    try {
      const response = await apiService.createMySubscription(plan);
      if (response.success) {
        setSubscription(response.data);
        await AsyncStorage.removeItem(POST_REGISTRATION_SUBSCRIPTION_KEY);
        Alert.alert('Subscription selected', response.message || 'Your subscription has been selected.', [
          { text: 'Continue', onPress: finish }
        ]);
      }
    } catch (error) {
      Alert.alert('Subscription error', error.message || 'Unable to select this plan.');
    } finally {
      setSelectingPlanId(null);
    }
  };

  const formatPrice = (plan) => {
    const price = Number(plan?.price || 0);
    const currency = plan?.currency || 'USD';
    if (price <= 0) return 'Included';
    return `${currency} ${price.toLocaleString()} / ${plan.billingCycle || 'month'}`;
  };

  const isSelected = (plan) => {
    const selectedPlanId = subscription?.plan?._id || subscription?.plan?.id || subscription?.plan;
    return selectedPlanId && selectedPlanId === (plan.id || plan._id);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F37021" />
          <Text style={styles.loadingText}>Loading subscription options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialIcons name="workspace-premium" size={28} color="#F37021" />
        </View>
        <Text style={styles.title}>Choose your subscription</Text>
        <Text style={styles.subtitle}>
          Select a plan now, or skip and manage it later from Profile.
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {plans.map((plan) => {
          const planId = plan.id || plan._id || plan.code;
          const selected = isSelected(plan);
          const selecting = selectingPlanId === planId;

          return (
            <TouchableOpacity
              key={planId}
              style={[styles.planCard, selected && styles.planCardSelected]}
              onPress={() => selectPlan(plan)}
              disabled={Boolean(selectingPlanId)}
            >
              <View style={styles.planHeader}>
                <View style={styles.planIcon}>
                  <MaterialIcons name={selected ? 'check-circle' : 'local-shipping'} size={22} color={selected ? '#16a34a' : '#0C2D48'} />
                </View>
                <View style={styles.planTitleBlock}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
                </View>
              </View>

              {!!plan.description && <Text style={styles.planDescription}>{plan.description}</Text>}

              {(plan.features || []).slice(0, 4).map((feature, index) => (
                <View key={`${planId}-${index}`} style={styles.featureRow}>
                  <MaterialIcons name="check" size={16} color="#F37021" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}

              <View style={styles.planAction}>
                {selecting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.planActionText}>{selected ? 'Current Plan' : 'Select Subscription'}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {!plans.length && (
          <View style={styles.emptyState}>
            <MaterialIcons name="info-outline" size={28} color="#64748b" />
            <Text style={styles.emptyTitle}>No plans available</Text>
            <Text style={styles.emptyText}>You can continue and choose a subscription from Profile when plans are available.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.skipButton} onPress={finish} disabled={Boolean(selectingPlanId)}>
          <Text style={styles.skipButtonText}>Skip for later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 15
  },
  header: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  title: {
    color: 'white',
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    color: '#dbeafe',
    fontSize: 15,
    lineHeight: 22
  },
  content: {
    flex: 1
  },
  contentInner: {
    padding: 16,
    paddingBottom: 34
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3
  },
  planCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4'
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  planIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  planTitleBlock: {
    flex: 1
  },
  planName: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800'
  },
  planPrice: {
    color: '#F37021',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3
  },
  planDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7
  },
  featureText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    lineHeight: 18
  },
  planAction: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#F37021',
    alignItems: 'center',
    justifyContent: 'center'
  },
  planActionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800'
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6
  },
  skipButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center'
  },
  skipButtonText: {
    color: '#0C2D48',
    fontSize: 15,
    fontWeight: '800'
  }
});

export { POST_REGISTRATION_SUBSCRIPTION_KEY };
export default SubscriptionOnboardingScreen;
