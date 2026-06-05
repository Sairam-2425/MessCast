import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius } from '../../constants/theme';

interface NeonBadgeProps {
  count: number;
  max?: number;
}

export function NeonBadge({ count, max = 99 }: NeonBadgeProps) {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  const isWide = count > 9;

  return (
    <View style={[styles.badge, isWide ? styles.wide : styles.compact]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    minWidth: 20,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  compact: { paddingHorizontal: 0 },
  wide: { paddingHorizontal: 5 },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
    lineHeight: 14,
  },
});
