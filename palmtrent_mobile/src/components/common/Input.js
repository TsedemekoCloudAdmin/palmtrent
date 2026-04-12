// components/common/Input.js
// Standardized Input component

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors, typography, spacing, borderRadius } from '../../theme';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  required = false,
  style,
  inputStyle,
  containerStyle,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const showPasswordToggle = secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          !editable && styles.inputDisabled,
          multiline && styles.inputMultiline,
          style,
        ]}
      >
        {leftIcon && (
          <MaterialIcons
            name={leftIcon}
            size={20}
            color={isFocused ? colors.primary : colors.textSecondary}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
            multiline && styles.inputMultilineText,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIconButton}
          >
            <MaterialIcons
              name={isPasswordVisible ? 'visibility-off' : 'visibility'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !showPasswordToggle && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
          >
            <MaterialIcons
              name={rightIcon}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={14} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {helperText && !error && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.backgroundDark,
  },
  inputMultiline: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  inputMultilineText: {
    textAlignVertical: 'top',
  },
  leftIcon: {
    marginLeft: spacing.md,
  },
  rightIconButton: {
    padding: spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginLeft: spacing.xs,
  },
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

export default Input;
