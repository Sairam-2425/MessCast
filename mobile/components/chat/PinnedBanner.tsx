import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';

interface PinnedBannerProps {
  content: string | null;
  fileName?: string | null;
  messageType?: 'text' | 'file';
  onPress: () => void;
  onUnpin: () => void;
}

export function PinnedBanner({ content, fileName, messageType, onPress, onUnpin }: PinnedBannerProps) {
  const preview = messageType === 'file' ? `📎 ${fileName ?? 'File'}` : content ?? '';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <Feather name="bookmark" size={14} color={Colors.primary} style={styles.icon} />
      <View style={styles.textContainer}>
        <Text style={styles.label}>Pinned message</Text>
        <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <TouchableOpacity onPress={onUnpin} style={styles.close}>
        <Feather name="x" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgLayer1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  icon: { marginRight: 4 },
  textContainer: { flex: 1 },
  label: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: 1,
  },
  preview: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  close: { padding: 4 },
});
