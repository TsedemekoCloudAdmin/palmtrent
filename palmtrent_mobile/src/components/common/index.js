// components/common/index.js
// Export all common UI components

export { default as Button } from './Button';
export { default as Input } from './Input';
export { default as Card } from './Card';
export { default as StatusBadge } from './StatusBadge';
export { default as ScreenHeader } from './ScreenHeader';
export { default as ActionButton } from './ActionButton';

// Re-export theme for convenience
export {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  commonStyles,
  getStatusBadgeStyle,
  hexToRgba,
} from '../../theme';
