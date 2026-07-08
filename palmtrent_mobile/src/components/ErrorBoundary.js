import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Catches render/runtime errors in its subtree so a bad screen shows a friendly
// fallback instead of hard-closing the whole app (React Native unmounts the root
// on an uncaught render error). Wrap screens that render server data.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong.' };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <MaterialIcons name="error-outline" size={56} color="#dc2626" />
        <Text style={styles.title}>{this.props.title || 'This screen ran into a problem'}</Text>
        <Text style={styles.message}>
          {this.props.message || 'Please go back and try again. If it keeps happening, contact support.'}
        </Text>
        <View style={styles.actions}>
          {this.props.onBack ? (
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={this.props.onBack}>
              <Text style={styles.buttonSecondaryText}>Go Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#e5e7eb',
  },
  buttonSecondaryText: {
    color: '#111827',
    fontWeight: '600',
  },
});

export default ErrorBoundary;
