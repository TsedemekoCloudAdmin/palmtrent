import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

/**
 * Standardized Action Button component for quick actions across the app
 *
 * @param {string} icon - MaterialIcons icon name
 * @param {string} title - Main title text
 * @param {string} subtitle - Description text below title
 * @param {string} color - Color theme: 'blue' | 'green' | 'purple' | 'orange' | 'red'
 * @param {string} badge - Optional badge text (e.g., "3 new")
 * @param {function} onPress - Press handler
 * @param {object} style - Additional container styles
 */
const ActionButton = React.memo(({
  icon,
  title,
  subtitle,
  color = 'blue',
  badge,
  onPress,
  style
}) => {
  const colorStyles = {
    blue: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
    green: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
    purple: { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' },
    orange: { backgroundColor: '#fff7ed', borderColor: '#ffcd91' },
    red: { backgroundColor: '#fef2f2', borderColor: '#fecaca' }
  };

  const iconColors = {
    blue: '#0C2D48',
    green: '#16a34a',
    purple: '#7c3aed',
    orange: '#F37021',
    red: '#dc2626'
  };

  return (
    <TouchableOpacity
      style={[styles.actionButton, colorStyles[color], style]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <MaterialIcons name={icon} size={24} color={iconColors[color]} />
      </View>
      <View style={styles.actionContent}>
        <View style={styles.actionTitleRow}>
          <Text style={[styles.actionTitle, { color: iconColors[color] }]}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionContent: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  badge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ActionButton;
