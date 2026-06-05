import React, { useEffect, useState } from 'react';
import {
  Modal,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export function FullscreenImageViewer({ visible, imageUrl, onClose }: Props) {
  const scale   = useSharedValue(1);
  const saved   = useSharedValue(1);
  const tx      = useSharedValue(0);
  const ty      = useSharedValue(0);
  const stx     = useSharedValue(0);
  const sty     = useSharedValue(0);
  const bgAlpha = useSharedValue(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      scale.value   = 1;
      saved.value   = 1;
      tx.value      = 0;
      ty.value      = 0;
      stx.value     = 0;
      sty.value     = 0;
      bgAlpha.value = 1;
    }
  }, [visible]);

  // ── Gesture: pinch to zoom ──────────────────────────────────────────────────
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(saved.value * e.scale, 6));
    })
    .onEnd(() => {
      saved.value = scale.value < 1.1 ? 1 : scale.value;
      scale.value = withSpring(saved.value);
      if (saved.value <= 1) {
        tx.value  = withSpring(0);
        ty.value  = withSpring(0);
        stx.value = 0;
        sty.value = 0;
      }
    });

  // ── Gesture: pan (move when zoomed, swipe-down to dismiss when at 1:1) ─────
  const pan = Gesture.Pan()
    .onBegin(() => {
      stx.value = tx.value;
      sty.value = ty.value;
    })
    .onUpdate((e) => {
      if (saved.value <= 1) {
        ty.value      = e.translationY;
        bgAlpha.value = Math.max(0.2, 1 - Math.abs(e.translationY) / 400);
      } else {
        tx.value = stx.value + e.translationX;
        ty.value = sty.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (saved.value <= 1) {
        if (Math.abs(e.translationY) > 100 || Math.abs(e.velocityY) > 600) {
          onClose();
        } else {
          ty.value      = withSpring(0);
          bgAlpha.value = withTiming(1);
        }
      } else {
        stx.value = tx.value;
        sty.value = ty.value;
      }
    });

  // ── Gesture: double-tap to toggle zoom ─────────────────────────────────────
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (saved.value > 1) {
        saved.value = 1;
        scale.value = withSpring(1);
        tx.value    = withSpring(0);
        ty.value    = withSpring(0);
        stx.value   = 0;
        sty.value   = 0;
      } else {
        saved.value = 2.5;
        scale.value = withSpring(2.5);
      }
    });

  const composed = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan)
  );

  const imgStyle = useAnimatedStyle(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ] as any,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgAlpha.value })) as any;

  // ── Share / save image ──────────────────────────────────────────────────────
  // Uses only built-in React Native APIs — no extra native modules required.
  //
  // iOS:  Share.share({ url }) opens the native share sheet.
  //       The sheet includes a "Save Image" button that writes to the Photos app.
  //       No media-library permission prompt is shown.
  //
  // Android: Share.share({ message: url }) lets the user choose an app to open
  //          the image with (e.g. Google Photos, Downloads).
  //
  // To upgrade to a direct "Save to Camera Roll" (bypassing the sheet), install
  // expo-media-library and call MediaLibrary.saveToLibraryAsync(localUri) — but
  // this is not required for the viewer to work.
  async function shareImage() {
    if (!imageUrl || saving) return;
    setSaving(true);
    try {
      const payload = Platform.OS === 'ios'
        ? { url: imageUrl }
        : { message: imageUrl };

      await Share.share(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // User cancelled the share sheet — don't show an error
      if (msg.includes('cancel') || msg.includes('Cancel') || msg.includes('denied')) return;
      Alert.alert('Could not share image', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.bg, bgStyle]} />

      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.imgWrap, imgStyle]}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.img}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Close */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Feather name="x" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Share / Save */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={shareImage}
        disabled={saving}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <Feather name="share" size={19} color="#fff" />}
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgWrap: {
    width: W,
    height: H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: W,
    height: H,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
