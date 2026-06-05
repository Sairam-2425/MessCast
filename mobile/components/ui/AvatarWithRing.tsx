import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';

interface AvatarWithRingProps {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  size?: number;
  isOnline?: boolean;
  showRing?: boolean;
  style?: ViewStyle;
}

export function AvatarWithRing({
  avatarUrl,
  displayName,
  size = 44,
  isOnline = false,
  showRing = true,
  style,
}: AvatarWithRingProps) {
  const safeDisplayName = displayName ?? '';
  const initials =
    safeDisplayName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  const fullUrl = avatarUrl
    ? avatarUrl.startsWith('http')
      ? avatarUrl
      : `${BASE_URL}${avatarUrl}`
    : null;

  const dotSize = Math.max(10, size * 0.24);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.ring,
          showRing && styles.ringVisible,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {fullUrl ? (
          <Image
            source={{ uri: fullUrl }}
            style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
          />
        ) : (
          <View
            style={[
              styles.initials,
              { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
            ]}
          >
            <Text style={[styles.initialsText, { fontSize: size * 0.32 }]}>{initials}</Text>
          </View>
        )}
      </View>
      {isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringVisible: {
    borderColor: Colors.avatarRing,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  initials: {
    backgroundColor: Colors.bgLayer2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  onlineDot: {
    backgroundColor: Colors.onlineDot,
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.bgBase,
  },
});
