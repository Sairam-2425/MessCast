import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from '../ui/GlassCard';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Feather.glyphMap;
  color?: string;
}

export function StatCard({ label, value, icon, color = Colors.primary }: StatCardProps) {
  return (
    <GlassCard style={styles.card} accent>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${color}22`,
            borderColor: `${color}44`,
            shadowColor: color,
          },
        ]}
      >
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    minWidth: '45%',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  value: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
