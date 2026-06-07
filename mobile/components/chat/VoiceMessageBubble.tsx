import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { BASE_URL } from '../../constants/config';

interface Props {
  fileUrl: string;
  isSent: boolean;
}

function msToTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
}

export function VoiceMessageBubble({ fileUrl, isSent }: Props) {
  const [sound, setSound]     = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos]         = useState(0);
  const [dur, setDur]         = useState(0);
  const progress              = useSharedValue(0);

  const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${BASE_URL}${fileUrl}`;

  useEffect(() => {
    console.log('[Voice] playback URL', fullUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullUrl]);

  // Preload duration on mount so the time label is visible before first play.
  // Use a ref for the probe sound so cleanup can unload it even if the async
  // completes after the cleanup function has already run.
  const probeRef = useRef<Audio.Sound | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s, status } = await Audio.Sound.createAsync(
          { uri: fullUrl },
          { shouldPlay: false }
        );
        probeRef.current = s;
        if (active && status.isLoaded && status.durationMillis) {
          setDur(status.durationMillis);
        } else if (!active) {
          // Cleanup already ran — unload immediately
          s.unloadAsync();
          probeRef.current = null;
        }
      } catch {}
    })();
    return () => {
      active = false;
      probeRef.current?.unloadAsync();
      probeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullUrl]);

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  async function toggle() {
    if (sound) {
      if (playing) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
      return;
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s, status } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { shouldPlay: true },
        (st) => {
          if (!st.isLoaded) return;
          const d = st.durationMillis ?? dur;
          const p = st.positionMillis;
          setDur(d);
          setPos(p);
          progress.value = withTiming(d > 0 ? p / d : 0, { duration: 100 });
          if (st.didJustFinish) {
            setPlaying(false);
            setPos(0);
            progress.value = withTiming(0);
          }
        }
      );
      setSound(s);
      if (status.isLoaded) setDur(status.durationMillis ?? 0);
      setPlaying(true);
    } catch (err: unknown) {
      console.log('[Voice] playback failed', fullUrl, err instanceof Error ? err.message : err);
      Alert.alert('Playback error', 'Could not play this voice message. Please try again.');
    }
  }

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  const trackColor = isSent ? 'rgba(255,255,255,0.25)' : Colors.glassBorder;
  const fillColor  = isSent ? 'rgba(255,255,255,0.75)' : Colors.primary;
  const timeColor  = isSent ? 'rgba(255,255,255,0.60)' : Colors.textTertiary;

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={toggle} style={styles.playBtn} activeOpacity={0.7}>
        <Feather name={playing ? 'pause' : 'play'} size={17} color="#fff" />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <Animated.View style={[styles.fill, fillStyle, { backgroundColor: fillColor }]} />
        </View>
        <Text style={[styles.time, { color: timeColor }]}>
          {pos > 0 ? msToTime(pos) : dur > 0 ? msToTime(dur) : '0:00'}
        </Text>
      </View>

      <Feather
        name="mic"
        size={13}
        color={isSent ? 'rgba(255,255,255,0.50)' : Colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 160,
    paddingVertical: 4,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  time: {
    fontSize: FontSize.xs,
  },
});
