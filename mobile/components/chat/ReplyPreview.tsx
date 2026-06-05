import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

interface ReplyPreviewProps {
  senderName: string;
  content: string | null;
  fileName?: string | null;
  type: 'text' | 'file';
  isSent?: boolean;
}

export function ReplyPreview({ senderName, content, fileName, type, isSent }: ReplyPreviewProps) {
  const preview = type === 'file' ? `📎 ${fileName ?? 'File'}` : content ?? '';

  return (
    <View style={[styles.container, isSent ? styles.sentBorder : styles.receivedBorder]}>
      <Text style={styles.sender} numberOfLines={1}>{senderName}</Text>
      <Text style={styles.content} numberOfLines={2}>{preview}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  sentBorder: { borderLeftColor: Colors.secondary },
  receivedBorder: { borderLeftColor: Colors.primary },
  sender: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  content: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});
