import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

interface ReadReceiptProps {
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  memberCount: number;
}

export function ReadReceipt({ sentCount, deliveredCount, readCount, memberCount }: ReadReceiptProps) {
  const allRead = readCount >= memberCount - 1;
  const allDelivered = deliveredCount >= memberCount - 1;

  if (allRead) {
    return (
      <View style={styles.row}>
        <Feather name="check" size={11} color={Colors.secondary} />
        <Feather name="check" size={11} color={Colors.secondary} style={styles.second} />
      </View>
    );
  }

  if (allDelivered) {
    return (
      <View style={styles.row}>
        <Feather name="check" size={11} color={Colors.textTertiary} />
        <Feather name="check" size={11} color={Colors.textTertiary} style={styles.second} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Feather name="check" size={11} color={Colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  second: {
    marginLeft: -4,
  },
});
