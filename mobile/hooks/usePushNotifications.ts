import { useEffect, useRef } from 'react';
// `import type` is erased entirely by TypeScript/Babel at compile time.
// It produces zero runtime code, so expo-notifications is never loaded by this line.
import type { EventSubscription } from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

// ─── Environment guards (evaluated once at module load, before any hook runs) ──

// True when running inside Expo Go (the "store client").
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Android push notifications were fully removed from the Expo Go binary in SDK 53.
// expo-notifications/build/index.js auto-executes DevicePushTokenAutoRegistration.fx.js
// at import time, which immediately calls addPushTokenListener → crash on Android Expo Go.
// Guarding useEffect calls is NOT enough — the crash fires at the `import` statement.
// Fix: use `await import()` inside effects so the module only loads after this guard runs.
const notificationsAvailable = !(isExpoGo && Platform.OS === 'android');

// Push-token registration additionally requires a physical device and a real build.
// Expo Go (any platform) cannot obtain FCM / APNs push tokens.
const canRegisterForPush = !isExpoGo && Device.isDevice;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  // Types come from `import type` above — no runtime import.
  const notificationListenerRef = useRef<EventSubscription | undefined>(undefined);
  const responseListenerRef = useRef<EventSubscription | undefined>(undefined);

  // Set the foreground display handler once.
  // Uses dynamic import so expo-notifications is never loaded on Android Expo Go.
  useEffect(() => {
    if (!notificationsAvailable) return;

    let active = true;
    import('expo-notifications').then((N) => {
      if (!active) return;
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    });

    return () => { active = false; };
  }, []);

  // Register for push tokens and attach the tap-to-navigate listener.
  useEffect(() => {
    if (!notificationsAvailable) return;
    if (!user) return;

    let active = true;

    async function setup() {
      // Dynamic import — only executes here, after all guards above have passed.
      const N = await import('expo-notifications');
      if (!active) return;

      // ── Push token registration (dev / prod builds on real devices only) ──
      if (canRegisterForPush) {
        const { status: existingStatus } = await N.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          if (Platform.OS === 'android') {
            await N.setNotificationChannelAsync('default', {
              name: 'default',
              importance: N.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#7C5CFC',
            });
          }

          try {
            const projectId =
              Constants.expoConfig?.extra?.eas?.projectId ??
              Constants.easConfig?.projectId;

            // Skip when app.json still has the placeholder value.
            if (projectId && projectId !== 'your-project-id') {
              const tokenData = await N.getExpoPushTokenAsync({ projectId });
              await api.patch('/api/users/me/push-token', { token: tokenData.data });
            }
          } catch {
            // Token fetch can fail before permissions fully settle — ignore silently.
          }
        }
      }

      if (!active) return;

      // ── Tap-on-notification → navigate to the relevant chat ──
      responseListenerRef.current = N.addNotificationResponseReceivedListener(
        (response) => {
          const conversationId = response.notification.request.content.data
            ?.conversationId as string;
          if (conversationId) router.push(`/chat/${conversationId}`);
        }
      );
    }

    setup();

    return () => {
      active = false;
      responseListenerRef.current?.remove();
      notificationListenerRef.current?.remove();
    };
  }, [user]);
}
