import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const { width } = Dimensions.get('window');

const payoutMethodLabels = {
  ecocash: 'EcoCash',
  onemoney: 'OneMoney',
  bank_transfer: 'Bank Transfer'
};

const emptyPayoutForm = {
  payoutMethod: 'ecocash',
  accountNumber: '',
  accountName: '',
  bankName: ''
};

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const EarningsScreen = ({ navigation, onNavigate }) => {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    pendingEarnings: 0,
    completedTrips: 0,
    recentEarnings: []
  });
  const [stats, setStats] = useState({
    avgPerJob: 0,
    jobsThisMonth: 0,
    onTimeRate: 0
  });
  const [balanceData, setBalanceData] = useState({
    availableBalance: 0,
    pendingBalance: 0,
    pendingWithdrawalBalance: 0,
    totalWithdrawn: 0,
    recentReleased: []
  });
  const [payoutPreferences, setPayoutPreferences] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState(emptyPayoutForm);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await apiService.request(`/transporter/earnings?period=${period}`);
      if (response.success) {
        setEarningsData(response.data);

        // Calculate stats
        const avgPerJob = response.data.completedTrips > 0
          ? Math.round(response.data.totalEarnings / response.data.completedTrips)
          : 0;

        setStats(prev => ({
          ...prev,
          avgPerJob,
          jobsThisMonth: response.data.completedTrips
        }));
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  }, [period]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await apiService.request('/transporter/dashboard-stats');
      if (response.success) {
        setStats(prev => ({
          ...prev,
          onTimeRate: response.data.onTimeDelivery ?? 0
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }, []);

  const fetchPayoutData = useCallback(async () => {
    try {
      const [balanceResponse, preferenceResponse, historyResponse] = await Promise.all([
        apiService.getTransporterBalance(),
        apiService.getPayoutPreferences(),
        apiService.getWithdrawalHistory()
      ]);

      if (balanceResponse.success) {
        setBalanceData(balanceResponse.data || {});
        setWithdrawalAmount(String(balanceResponse.data?.availableBalance || ''));
      }

      if (preferenceResponse.success) {
        const preferences = preferenceResponse.data || {};
        setPayoutPreferences(preferences);
        setPayoutForm({
          payoutMethod: preferences.method || 'ecocash',
          accountNumber: preferences.accountNumber || '',
          accountName: preferences.accountName || '',
          bankName: preferences.bankName || ''
        });
      }

      if (historyResponse.success) {
        setWithdrawals(historyResponse.data?.withdrawals || []);
      }
    } catch (error) {
      console.error('Failed to fetch payout data:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEarnings(), fetchDashboardStats(), fetchPayoutData()]);
      setLoading(false);
    };
    loadData();
  }, [fetchEarnings, fetchDashboardStats, fetchPayoutData]);

  useEffect(() => {
    // Refetch when period changes
    fetchEarnings();
  }, [period, fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchEarnings(), fetchDashboardStats(), fetchPayoutData()]);
    setRefreshing(false);
  }, [fetchEarnings, fetchDashboardStats, fetchPayoutData]);

  const updatePayoutForm = (field, value) => {
    setPayoutForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSavePayoutPreferences = async () => {
    if (!payoutForm.payoutMethod || !payoutForm.accountNumber.trim()) {
      Alert.alert('Missing Details', 'Select a payout method and enter the payout account.');
      return;
    }

    setSavingPayout(true);
    try {
      const response = await apiService.updatePayoutPreferences({
        payoutMethod: payoutForm.payoutMethod,
        accountNumber: payoutForm.accountNumber.trim(),
        accountName: payoutForm.accountName.trim(),
        bankName: payoutForm.bankName.trim()
      });

      if (!response.success) {
        throw new Error(response.message || 'Unable to save payout preferences');
      }

      setPayoutPreferences(response.data);
      setShowPayoutModal(false);
      Alert.alert('Saved', 'Payout preferences updated.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save payout preferences');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    const preferences = payoutPreferences || {};
    const payoutMethod = preferences.method || payoutForm.payoutMethod;
    const accountNumber = preferences.accountNumber || payoutForm.accountNumber;

    if (!payoutMethod || !accountNumber) {
      Alert.alert('Payout Method Required', 'Add a payout method before requesting a withdrawal.');
      setShowWithdrawalModal(false);
      setShowPayoutModal(true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid withdrawal amount.');
      return;
    }

    setRequestingWithdrawal(true);
    try {
      const response = await apiService.requestWithdrawal({
        amount,
        payoutMethod,
        accountNumber,
        accountName: preferences.accountName || payoutForm.accountName,
        bankName: preferences.bankName || payoutForm.bankName
      });

      if (!response.success) {
        throw new Error(response.message || 'Unable to request withdrawal');
      }

      setShowWithdrawalModal(false);
      Alert.alert('Withdrawal Queued', response.message || 'Your withdrawal request has been queued.');
      await fetchPayoutData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to request withdrawal');
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  const payoutSummary = () => {
    if (!payoutPreferences?.method) return 'No payout method configured';
    const label = payoutMethodLabels[payoutPreferences.method] || payoutPreferences.method;
    const account = payoutPreferences.accountNumber || payoutPreferences.phone || '';
    const masked = account.length > 4 ? `${account.slice(0, 4)}****${account.slice(-4)}` : '****';
    return `${label}: ${masked}`;
  };

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      default: return 'All Time';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Earnings</Text>
          <Text style={styles.headerSubtitle}>Track your income</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Earnings</Text>
          <Text style={styles.headerSubtitle}>Track your income</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Period Selector */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodContainer}>
            <PeriodButton
              label="This Week"
              active={period === 'week'}
              onPress={() => setPeriod('week')}
            />
            <PeriodButton
              label="This Month"
              active={period === 'month'}
              onPress={() => setPeriod('month')}
            />
            <PeriodButton
              label="This Year"
              active={period === 'year'}
              onPress={() => setPeriod('year')}
            />
            <PeriodButton
              label="All Time"
              active={period === 'all'}
              onPress={() => setPeriod('all')}
            />
          </ScrollView>
        </View>

        {/* Total Earnings */}
        <View style={styles.section}>
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Total Earnings ({getPeriodLabel()})</Text>
            <Text style={styles.earningsAmount}>
              {money(earningsData.totalEarnings)}
            </Text>

            <View style={styles.earningsStats}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>Completed</Text>
                <Text style={styles.earningsStatValue}>{earningsData.completedTrips || 0}</Text>
              </View>
              <View style={[styles.earningsStat, styles.earningsStatDivider]}>
                <Text style={styles.earningsStatLabel}>Pending</Text>
                <Text style={styles.earningsStatValue}>
                  {money(earningsData.pendingEarnings)}
                </Text>
              </View>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>On-Time</Text>
                <Text style={styles.earningsStatValue}>{stats.onTimeRate}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Withdrawal Balance */}
        <View style={styles.section}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View>
                <Text style={styles.balanceLabel}>Available to Withdraw</Text>
                <Text style={styles.balanceAmount}>{money(balanceData.availableBalance)}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.withdrawButton,
                  Number(balanceData.availableBalance || 0) <= 0 && styles.withdrawButtonDisabled
                ]}
                disabled={Number(balanceData.availableBalance || 0) <= 0}
                onPress={() => {
                  setWithdrawalAmount(String(balanceData.availableBalance || ''));
                  setShowWithdrawalModal(true);
                }}
              >
                <Text style={styles.withdrawButtonText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.balanceStats}>
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatLabel}>Pending Release</Text>
                <Text style={styles.balanceStatValue}>{money(balanceData.pendingBalance)}</Text>
              </View>
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatLabel}>Queued Withdrawals</Text>
                <Text style={styles.balanceStatValue}>{money(balanceData.pendingWithdrawalBalance)}</Text>
              </View>
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatLabel}>Withdrawn</Text>
                <Text style={styles.balanceStatValue}>{money(balanceData.totalWithdrawn)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <StatCard
              icon="trending-up"
              label="Avg per Job"
              value={`$${stats.avgPerJob}`}
              change={stats.avgPerJob > 250 ? '+Good' : ''}
              color="#2563eb"
            />
            <StatCard
              icon="event"
              label="Jobs Completed"
              value={earningsData.completedTrips?.toString() || '0'}
              change=""
              color="#7c3aed"
            />
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Recent Transactions</Text>
            </View>

            <View style={styles.transactionsList}>
              {earningsData.recentEarnings && earningsData.recentEarnings.length > 0 ? (
                earningsData.recentEarnings.map((txn) => (
                  <TransactionItem
                    key={txn.id}
                    transaction={{
                      id: txn.reference || txn.id,
                      date: formatDate(txn.date),
                      route: txn.route || 'Completed Trip',
                      amount: txn.amount,
                      status: txn.status || 'paid'
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyTransactions}>
                  <MaterialIcons name="receipt-long" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No transactions yet</Text>
                  <Text style={styles.emptySubtext}>
                    Complete jobs to see your earnings here
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Pending Earnings Info */}
        {earningsData.pendingEarnings > 0 && (
          <View style={styles.section}>
            <View style={styles.pendingCard}>
              <MaterialIcons name="hourglass-empty" size={24} color="#92400e" />
              <View style={styles.pendingContent}>
                <Text style={styles.pendingTitle}>Pending Payout</Text>
                <Text style={styles.pendingAmount}>
                  {money(earningsData.pendingEarnings)}
                </Text>
                <Text style={styles.pendingNote}>
                  Funds will be released after delivery confirmation
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payout Settings */}
        <View style={styles.section}>
          <View style={styles.payoutCard}>
            <Text style={styles.payoutTitle}>Payout Method</Text>
            <Text style={styles.payoutText}>{payoutSummary()}</Text>
            <TouchableOpacity style={styles.payoutButton} onPress={() => setShowPayoutModal(true)}>
              <Text style={styles.payoutButtonText}>
                {payoutPreferences?.method ? 'Change Payout Method' : 'Add Payout Method'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Withdrawal History */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Withdrawal History</Text>
            </View>
            {withdrawals.length > 0 ? (
              <View style={styles.transactionsList}>
                {withdrawals.map((withdrawal) => (
                  <WithdrawalItem key={withdrawal.reference} withdrawal={withdrawal} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyTransactions}>
                <MaterialIcons name="account-balance-wallet" size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>No withdrawals yet</Text>
                <Text style={styles.emptySubtext}>
                  Released settlement payouts will appear here after you withdraw
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <PayoutPreferencesModal
        visible={showPayoutModal}
        form={payoutForm}
        saving={savingPayout}
        onChange={updatePayoutForm}
        onClose={() => setShowPayoutModal(false)}
        onSave={handleSavePayoutPreferences}
      />

      <WithdrawalModal
        visible={showWithdrawalModal}
        amount={withdrawalAmount}
        balance={balanceData.availableBalance}
        payoutSummary={payoutSummary()}
        requesting={requestingWithdrawal}
        onChangeAmount={setWithdrawalAmount}
        onClose={() => setShowWithdrawalModal(false)}
        onSubmit={handleRequestWithdrawal}
      />
    </SafeAreaView>
  );
};

// Helper Components
const PeriodButton = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[
      styles.periodButton,
      active && styles.periodButtonActive
    ]}
    onPress={onPress}
  >
    <Text style={[
      styles.periodButtonText,
      active && styles.periodButtonTextActive
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const StatCard = ({ icon, label, value, change, color }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
      <MaterialIcons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statValueContainer}>
      <Text style={styles.statValue}>{value}</Text>
      {change ? (
        <Text style={styles.statChange}>{change}</Text>
      ) : null}
    </View>
  </View>
);

const TransactionItem = ({ transaction }) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionInfo}>
      <Text style={styles.transactionRoute}>{transaction.route}</Text>
      <View style={styles.transactionMeta}>
        <Text style={styles.transactionId}>{transaction.id}</Text>
        <Text style={styles.transactionDot}>•</Text>
        <Text style={styles.transactionDate}>{transaction.date}</Text>
      </View>
    </View>
    <View style={styles.transactionAmount}>
      <Text style={styles.transactionValue}>${transaction.amount}</Text>
      <View style={[
        styles.statusBadge,
        transaction.status === 'paid' ? styles.statusPaid : styles.statusPending
      ]}>
        <Text style={[
          styles.statusText,
          transaction.status === 'paid' ? styles.statusTextPaid : styles.statusTextPending
        ]}>
          {transaction.status}
        </Text>
      </View>
    </View>
  </View>
);

const WithdrawalItem = ({ withdrawal }) => (
  <View style={styles.transactionItem}>
    <View style={styles.transactionInfo}>
      <Text style={styles.transactionRoute}>{withdrawal.reference}</Text>
      <View style={styles.transactionMeta}>
        <Text style={styles.transactionId}>
          {payoutMethodLabels[withdrawal.payoutMethod] || withdrawal.payoutMethod}
        </Text>
        <Text style={styles.transactionDot}>-</Text>
        <Text style={styles.transactionDate}>{withdrawal.accountNumber}</Text>
        <Text style={styles.transactionDot}>-</Text>
        <Text style={styles.transactionDate}>{formatDateSafe(withdrawal.requestedAt)}</Text>
      </View>
    </View>
    <View style={styles.transactionAmount}>
      <Text style={styles.transactionValue}>{money(withdrawal.amount)}</Text>
      <View style={[
        styles.statusBadge,
        withdrawal.status === 'paid' ? styles.statusPaid : styles.statusPending
      ]}>
        <Text style={[
          styles.statusText,
          withdrawal.status === 'paid' ? styles.statusTextPaid : styles.statusTextPending
        ]}>
          {withdrawal.status}
        </Text>
      </View>
    </View>
  </View>
);

const formatDateSafe = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const PayoutPreferencesModal = ({ visible, form, saving, onChange, onClose, onSave }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payout Method</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.methodRow}>
          {Object.entries(payoutMethodLabels).map(([method, label]) => (
            <TouchableOpacity
              key={method}
              style={[styles.methodButton, form.payoutMethod === method && styles.methodButtonActive]}
              onPress={() => onChange('payoutMethod', method)}
            >
              <Text style={[
                styles.methodButtonText,
                form.payoutMethod === method && styles.methodButtonTextActive
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.modalInput}
          value={form.accountName}
          onChangeText={(value) => onChange('accountName', value)}
          placeholder="Account holder name"
          placeholderTextColor="#9ca3af"
        />
        <TextInput
          style={styles.modalInput}
          value={form.accountNumber}
          onChangeText={(value) => onChange('accountNumber', value)}
          placeholder={form.payoutMethod === 'bank_transfer' ? 'Bank account number' : 'Mobile money number'}
          placeholderTextColor="#9ca3af"
          keyboardType="phone-pad"
        />
        {form.payoutMethod === 'bank_transfer' && (
          <TextInput
            style={styles.modalInput}
            value={form.bankName}
            onChangeText={(value) => onChange('bankName', value)}
            placeholder="Bank name"
            placeholderTextColor="#9ca3af"
          />
        )}

        <TouchableOpacity
          style={[styles.modalPrimaryButton, saving && styles.withdrawButtonDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.modalPrimaryButtonText}>Save Payout Method</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const WithdrawalModal = ({
  visible,
  amount,
  balance,
  payoutSummary,
  requesting,
  onChangeAmount,
  onClose,
  onSubmit
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Request Withdrawal</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.withdrawalSummary}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{money(balance)}</Text>
          <Text style={styles.payoutText}>{payoutSummary}</Text>
        </View>

        <TextInput
          style={styles.modalInput}
          value={amount}
          onChangeText={onChangeAmount}
          placeholder="Withdrawal amount"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[styles.modalPrimaryButton, requesting && styles.withdrawButtonDisabled]}
          onPress={onSubmit}
          disabled={requesting}
        >
          {requesting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.modalPrimaryButtonText}>Queue Withdrawal</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  periodContainer: {
    marginBottom: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  periodButtonTextActive: {
    color: 'white',
  },
  earningsCard: {
    backgroundColor: '#0C2D48',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  earningsLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  earningsAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  earningsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsStat: {
    alignItems: 'center',
    flex: 1,
  },
  earningsStatDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  earningsStatLabel: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 4,
  },
  earningsStatValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  withdrawButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  withdrawButtonDisabled: {
    opacity: 0.5,
  },
  withdrawButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  balanceStats: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    gap: 10,
  },
  balanceStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceStatLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  balanceStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statChange: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionRoute: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transactionId: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  transactionDot: {
    fontSize: 12,
    color: '#9ca3af',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#dcfce7',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusTextPaid: {
    color: '#166534',
  },
  statusTextPending: {
    color: '#92400e',
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  pendingCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pendingContent: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  pendingAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  pendingNote: {
    fontSize: 12,
    color: '#b45309',
  },
  payoutCard: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  payoutText: {
    fontSize: 14,
    color: '#1e3a8a',
    marginBottom: 8,
  },
  payoutButton: {
    alignSelf: 'flex-start',
  },
  payoutButtonText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  methodButtonActive: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  methodButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  methodButtonTextActive: {
    color: 'white',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  modalPrimaryButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  withdrawalSummary: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
  },
  bottomPadding: {
    height: 20,
  },
});

export default EarningsScreen;
