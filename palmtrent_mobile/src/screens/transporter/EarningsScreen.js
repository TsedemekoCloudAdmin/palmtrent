import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

const EarningsScreen = ({ navigation, onNavigate }) => {
  const [period, setPeriod] = useState('month');

  const earnings = {
    thisMonth: 12500,
    pending: 2400,
    completed: 45,
    onTime: 97
  };

  const transactions = [
    { id: 'PT-2025-001234', date: '02 Nov', route: 'Harare → Bulawayo', amount: 400, status: 'paid' },
    { id: 'PT-2025-001235', date: '02 Nov', route: 'Mutare → Harare', amount: 350, status: 'pending' },
    { id: 'PT-2025-001236', date: '01 Nov', route: 'Harare → Gweru', amount: 280, status: 'paid' },
    { id: 'PT-2025-001237', date: '01 Nov', route: 'Harare → Masvingo', amount: 320, status: 'paid' }
  ];

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.earningsLabel}>Total Earnings (This Month)</Text>
            <Text style={styles.earningsAmount}>${earnings.thisMonth.toLocaleString()}</Text>
            
            <View style={styles.earningsStats}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>Completed</Text>
                <Text style={styles.earningsStatValue}>{earnings.completed}</Text>
              </View>
              <View style={[styles.earningsStat, styles.earningsStatDivider]}>
                <Text style={styles.earningsStatLabel}>Pending</Text>
                <Text style={styles.earningsStatValue}>${earnings.pending}</Text>
              </View>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsStatLabel}>On-Time</Text>
                <Text style={styles.earningsStatValue}>{earnings.onTime}%</Text>
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
              value="$278"
              change="+12%"
              color="#2563eb"
            />
            <StatCard
              icon="event"
              label="Jobs This Month"
              value="45"
              change="+8"
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
              {transactions.map((txn) => (
                <TransactionItem key={txn.id} transaction={txn} />
              ))}
            </View>
          </View>
        </View>

        {/* Payout Settings */}
        <View style={styles.section}>
          <View style={styles.payoutCard}>
            <Text style={styles.payoutTitle}>Payout Method</Text>
            <Text style={styles.payoutText}>EcoCash: 0771 234 5678</Text>
            <TouchableOpacity style={styles.payoutButton}>
              <Text style={styles.payoutButtonText}>Change Payout Method</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reduced bottom padding */}
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
      {change && (
        <Text style={styles.statChange}>{change}</Text>
      )}
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