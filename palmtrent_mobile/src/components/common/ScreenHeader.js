// components/common/ScreenHeader.js
// Standardized Screen Header component

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';

const ScreenHeader = ({
  title,
  subtitle,
  onBackPress,
  showBack = true,
  rightIcon,
  onRightPress,
  rightComponent,
  variant = 'primary', // 'primary', 'transparent', 'white'
  style,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'transparent':
        return {
          container: { backgroundColor: 'transparent' },
          text: colors.text,
          icon: colors.text,
          statusBar: 'dark-content',
        };
      case 'white':
        return {
          container: { backgroundColor: colors.surface },
          text: colors.text,
          icon: colors.text,
          statusBar: 'dark-content',
        };
      default: // primary
        return {
          container: { backgroundColor: colors.primary },
          text: colors.textInverse,
          icon: colors.textInverse,
          statusBar: 'light-content',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <>
      <StatusBar
        barStyle={variantStyles.statusBar}
        backgroundColor={variantStyles.container.backgroundColor}
      />
      <View style={[styles.header, variantStyles.container, style]}>
        <View style={styles.leftSection}>
          {showBack && onBackPress && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color={variantStyles.icon} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.centerSection}>
          <Text style={[styles.title, { color: variantStyles.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: variantStyles.text }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSection}>
          {rightComponent ? (
            rightComponent
          ) : rightIcon && onRightPress ? (
            <TouchableOpacity
              style={styles.rightButton}
              onPress={onRightPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name={rightIcon} size={24} color={variantStyles.icon} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? layout.statusBarHeight : spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: layout.headerHeight + (Platform.OS === 'ios' ? layout.statusBarHeight : 0),
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: spacing.xs,
  },
  rightButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    opacity: 0.8,
    marginTop: 2,
  },
});

export default ScreenHeader;
