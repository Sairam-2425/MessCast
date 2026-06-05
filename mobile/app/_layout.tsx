import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { connectSocket } from '../lib/socket';
import { Colors } from '../constants/theme';

const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.bgBase,
    surface: Colors.bgLayer2,
    onSurface: Colors.textPrimary,
  },
};

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { user, token, isHydrated } = useAuthStore();

  useSocket();
  usePushNotifications();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inUserGroup = segments[0] === '(user)';
    const inAdminGroup = segments[0] === '(admin)';

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Reconnect socket on navigation if needed
    if (token) connectSocket(token);

    if (user.role === 'admin') {
      if (!inAdminGroup && !['chat', 'contact', 'group'].includes(segments[0] as string)) {
        router.replace('/(admin)');
      }
    } else {
      if (!inUserGroup && !['chat', 'contact', 'group'].includes(segments[0] as string)) {
        router.replace('/(user)');
      }
    }
  }, [isHydrated, user, segments]);

  return null;
}

export default function RootLayout() {
  const { hydrate, isHydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <StatusBar backgroundColor={Colors.bgBase} barStyle="light-content" translucent={false} />
          <NavigationGuard />
          {!isHydrated ? (
            <View style={styles.splash}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.bgBase },
                animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
              }}
            />
          )}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  splash: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
