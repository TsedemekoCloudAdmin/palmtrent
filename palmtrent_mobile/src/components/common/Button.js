// components/common/Button.js
// Standardized Button component

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors, typography, spacing, borderRadius } from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'accent', 'outline', 'ghost', 'danger'
  size = 'medium', // 'small', 'medium', 'large'
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: { backgroundColor: colors.primary },
          text: { color: colors.textInverse },
          disabledContainer: { backgroundColor: colors.borderDark },
        };
      case 'secondary':
        return {
          container: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
          text: { color: colors.primary },
          disabledContainer: { borderColor: colors.borderDark },
          disabledText: { color: colors.textLight },
        };
      case 'accent':
        return {
          container: { backgroundColor: colors.accent },
          text: { color: colors.textInverse },
          disabledContainer: { backgroundColor: colors.borderDark },
        };
      case 'outline':
        return {
          container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
          text: { color: colors.text },
          disabledText: { color: colors.textLight },
        };
      case 'ghost':
        return {
          container: { backgroundColor: 'transparent' },
          text: { color: colors.primary },
          disabledText: { color: colors.textLight },
        };
      case 'danger':
        return {
          container: { backgroundColor: colors.error },
          text: { color: colors.textInverse },
          disabledContainer: { backgroundColor: colors.borderDark },
        };
      default:
        return {
          container: { backgroundColor: colors.primary },
          text: { color: colors.textInverse },
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
          text: { fontSize: typography.sizes.sm },
          icon: 18,
        };
      case 'large':
        return {
          container: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
          text: { fontSize: typography.sizes.lg },
          icon: 24,
        };
      default: // medium
        return {
          container: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
          text: { fontSize: typography.sizes.md },
          icon: 20,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        disabled && [styles.disabled, variantStyles.disabledContainer],
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variantStyles.text.color}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <MaterialIcons
              name={icon}
              size={sizeStyles.icon}
              color={disabled ? variantStyles.disabledText?.color || colors.textLight : variantStyles.text.color}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              sizeStyles.text,
              disabled && variantStyles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <MaterialIcons
              name={icon}
              size={sizeStyles.icon}
              color={disabled ? variantStyles.disabledText?.color || colors.textLight : variantStyles.text.color}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.weights.semibold,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

export default Button;
