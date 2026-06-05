import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

interface Reaction {
  emoji: string;
  users: string[];
}

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onReact }: ReactionBarProps) {
  if (!reactions?.length) return null;

  return (
    <View style={styles.row}>
      {reactions.map((r) => {
        const hasReacted = r.users.includes(currentUserId);
        return (
          <TouchableOpacity
            key={r.emoji}
            style={[styles.pill, hasReacted && styles.pillActive]}
            onPress={() => onReact(r.emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            <Text style={[styles.count, hasReacted && styles.countActive]}>{r.users.length}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(124,92,252,0.15)',
  },
  emoji: { fontSize: 13 },
  count: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  countActive: { color: Colors.primary },
});
