// components/common/StatusBadge.js
// Standardized Status Badge component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, getStatusBadgeStyle } from '../../theme';

const StatusBadge = ({
  status,
  label,
  size = 'medium', // 'small', 'medium', 'large'
  style,
  textStyle,
}) => {
  // Get status display text
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      pending_payment: 'Awaiting Payment',
      payment_pending: 'Awaiting Payment',
      payment_confirmed: 'Payment Confirmed',
      finding_transporter: 'Finding Transporter',
      matched: 'Matched',
      in_progress: 'In Progress',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
      disputed: 'Disputed',
      approved: 'Approved',
      rejected: 'Rejected',
      active: 'Active',
      inactive: 'Inactive',
      expired: 'Expired',
    };
    return labels[status] || status?.replace(/_/g, ' ').toUpperCase() || 'Unknown';
  };

  const statusStyle = getStatusBadgeStyle(status);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          badge: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
          text: { fontSize: typography.sizes.xs },
        };
      case 'large':
        return {
          badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
          text: { fontSize: typography.sizes.sm },
        };
      default: // medium
        return {
          badge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
          text: { fontSize: typography.sizes.xs },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: statusStyle.backgroundColor },
        sizeStyles.badge,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: statusStyle.color },
          sizeStyles.text,
          textStyle,
        ]}
      >
        {label || getStatusLabel(status)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },
});

export default StatusBadge;
