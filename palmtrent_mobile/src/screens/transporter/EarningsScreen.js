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
  ActivityIndicator
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const { width } = Dimensions.get('window');

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

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await apiService.request(`/transporter/earnings?period=${period}`);
      if (response.success) {
        setEarningsData(response.data);

        // Calculate stats
        const avgPerJob = response.data.completedTrips > 0
          ? Math.round(response.data.totalEarnings / response.data.completedTrips)
          : 0;

        setStats({
          avgPerJob,
          jobsThisMonth: response.data.completedTrips,
          onTimeRate: 97 // This would come from a separate endpoint
        });
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
          onTimeRate: response.data.onTimeDelivery || 97
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchEarnings(), fetchDashboardStats()]);
      setLoading(false);
    };
    loadData();
  }, [fetchEarnings, fetchDashboardStats]);

  useEffect(() => {
    // Refetch when period changes
    fetchEarnings();
  }, [period, fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchEarnings(), fetchDashboardStats()]);
    setRefreshing(false);
  }, [fetchEarnings, fetchDashboardStats]);

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
              ${earningsData.totalEarnings?.toLocaleString() || '0'}
            </Text>

            <View style={styles.earningsStats}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>Completed</Text>
                <Text style={styles.earningsStatValue}>{earningsData.completedTrips || 0}</Text>
              </View>
              <View style={[styles.earningsStat, styles.earningsStatDivider]}>
                <Text style={styles.earningsStatLabel}>Pending</Text>
                <Text style={styles.earningsStatValue}>
                  ${earningsData.pendingEarnings?.toLocaleString() || '0'}
                </Text>
              </View>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>On-Time</Text>
                <Text style={styles.earningsStatValue}>{stats.onTimeRate}%</Text>
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
              <TouchableOpacity style={styles.exportButton}>
                <MaterialIcons name="file-download" size={16} color="#0C2D48" />
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
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
                      status: 'paid'
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
                  ${earningsData.pendingEarnings?.toLocaleString()}
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
            <Text style={styles.payoutText}>EcoCash: ****5678</Text>
            <TouchableOpacity style={styles.payoutButton}>
              <Text style={styles.payoutButtonText}>Change Payout Method</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  bottomPadding: {
    height: 20,
  },
});

export default EarningsScreen;
