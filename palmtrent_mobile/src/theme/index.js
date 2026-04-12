// theme/index.js
// Palmtrent Design System - Centralized theme configuration

import { Dimensions, Platform, StyleSheet } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============ COLORS ============
export const colors = {
  // Primary brand colors
  primary: '#0C2D48',        // Deep navy - main brand color
  primaryDark: '#091E32',    // Darker navy for headers
  primaryLight: '#1e4d7a',   // Lighter navy for accents

  // Secondary/Accent colors
  accent: '#F37021',         // Orange - call to action
  accentDark: '#d45f1a',     // Darker orange
  accentLight: '#ff8c42',    // Lighter orange

  // Status colors
  success: '#16a34a',        // Green for success states
  successLight: '#22c55e',
  successBg: '#dcfce7',

  warning: '#f59e0b',        // Amber for warnings
  warningLight: '#fbbf24',
  warningBg: '#fef3c7',

  error: '#dc2626',          // Red for errors
  errorLight: '#ef4444',
  errorBg: '#fee2e2',

  info: '#0ea5e9',           // Blue for info
  infoLight: '#38bdf8',
  infoBg: '#dbeafe',

  // Background colors
  background: '#f9fafb',     // Main background (light gray)
  backgroundDark: '#f3f4f6',
  surface: '#ffffff',        // Card/surface background
  surfaceAlt: '#f8fafc',

  // Text colors
  text: '#1f2937',           // Primary text (dark gray)
  textSecondary: '#6b7280',  // Secondary text (medium gray)
  textLight: '#9ca3af',      // Light text (disabled/placeholder)
  textInverse: '#ffffff',    // White text on dark backgrounds

  // Border colors
  border: '#e5e7eb',         // Default border
  borderLight: '#f3f4f6',    // Light border
  borderDark: '#d1d5db',     // Darker border for emphasis

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Status badge colors
  statusPending: '#f59e0b',
  statusInProgress: '#0ea5e9',
  statusCompleted: '#16a34a',
  statusCancelled: '#dc2626',
  statusMatched: '#8b5cf6',

  // Transporter colors
  online: '#16a34a',
  offline: '#9ca3af',
  busy: '#f59e0b',

  // Rating colors
  star: '#fbbf24',
  starEmpty: '#d1d5db',

  // Social/Payment colors
  ecocash: '#00a859',
  onemoney: '#e30613',
  whatsapp: '#25d366',
};

// ============ TYPOGRAPHY ============
export const typography = {
  // Font families
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System'
  }),

  // Font sizes
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },

  // Font weights
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============ SPACING ============
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

// ============ BORDER RADIUS ============
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// ============ SHADOWS ============
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
};

// ============ LAYOUT ============
export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  containerPadding: 16,
  headerHeight: Platform.OS === 'ios' ? 44 : 56,
  tabBarHeight: 60,
  statusBarHeight: Platform.OS === 'ios' ? 44 : 24,
};

// ============ COMMON STYLES ============
export const commonStyles = StyleSheet.create({
  // Containers
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  contentPadding: {
    padding: spacing.base,
  },

  // Headers
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textInverse,
    opacity: 0.9,
    marginTop: spacing.xs,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.base,
  },
  cardBordered: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: colors.textInverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.base - 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  buttonAccent: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonAccentText: {
    color: colors.textInverse,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  buttonDisabled: {
    backgroundColor: colors.borderDark,
    opacity: 0.7,
  },

  // Inputs
  inputContainer: {
    marginBottom: spacing.base,
  },
  inputLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputErrorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },

  // Text styles
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  body: {
    fontSize: typography.sizes.base,
    color: colors.text,
    lineHeight: typography.sizes.base * typography.lineHeights.normal,
  },
  bodySecondary: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  link: {
    color: colors.accent,
    fontWeight: typography.weights.medium,
  },

  // Row layouts
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Center content
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Badges
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    marginBottom: spacing.base,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============ STATUS BADGE STYLES ============
export const getStatusBadgeStyle = (status) => {
  const statusStyles = {
    pending: { backgroundColor: colors.warningBg, color: colors.statusPending },
    in_progress: { backgroundColor: colors.infoBg, color: colors.statusInProgress },
    matched: { backgroundColor: '#f3e8ff', color: colors.statusMatched },
    picked_up: { backgroundColor: colors.infoBg, color: colors.statusInProgress },
    in_transit: { backgroundColor: colors.infoBg, color: colors.statusInProgress },
    delivered: { backgroundColor: colors.successBg, color: colors.statusCompleted },
    completed: { backgroundColor: colors.successBg, color: colors.statusCompleted },
    cancelled: { backgroundColor: colors.errorBg, color: colors.statusCancelled },
    payment_pending: { backgroundColor: colors.warningBg, color: colors.statusPending },
  };

  return statusStyles[status] || statusStyles.pending;
};

// ============ HELPER FUNCTIONS ============
export const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Default export
export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  commonStyles,
  getStatusBadgeStyle,
  hexToRgba,
};
