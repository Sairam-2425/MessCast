import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  noBorder?: boolean;
  /** Adds a top accent line in the primary color */
  accent?: boolean;
}

export function GlassCard({ children, style, noBorder, accent }: GlassCardProps) {
  return (
    <View style={[styles.card, noBorder && styles.noBorder, style]}>
      {accent && <View style={styles.accentLine} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgLayer1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    // Subtle elevation so cards lift off the base background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  noBorder: {
    borderWidth: 0,
  },
  accentLine: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 0,
    marginBottom: 0,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
});
