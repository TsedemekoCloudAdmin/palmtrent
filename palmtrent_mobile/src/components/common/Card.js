// components/common/Card.js
// Standardized Card component

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

const Card = ({
  children,
  variant = 'elevated', // 'elevated', 'outlined', 'filled'
  onPress,
  style,
  contentStyle,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return styles.outlined;
      case 'filled':
        return styles.filled;
      default: // elevated
        return styles.elevated;
    }
  };

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.9 } : {};

  return (
    <Container
      style={[styles.card, getVariantStyles(), style]}
      {...containerProps}
      {...props}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  elevated: {
    ...shadows.base,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  filled: {
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    padding: spacing.base,
  },
});

export default Card;
