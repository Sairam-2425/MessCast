import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight } from '../../constants/theme';
import { useChatStore } from '../../store/chatStore';

/** Height of the icon+label area, not counting the system nav inset. */
export const TAB_BAR_CONTENT_HEIGHT = 62;

function ActiveDot() {
  return <View style={dotStyle.dot} />;
}
const dotStyle = StyleSheet.create({
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
});

function UnreadDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyle.badge}>
      <Text style={badgeStyle.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}
const badgeStyle = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: Colors.bgBase,
  },
  text: {
    color: '#fff',
    fontSize: 8,
    fontWeight: FontWeight.bold,
    lineHeight: 11,
  },
});

export default function UserLayout() {
  const insets = useSafeAreaInsets();
  const conversations = useChatStore((s) => s.conversations);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  const tabBarHeight  = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
  const tabBarPadding = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          height:        tabBarHeight,
          paddingBottom: tabBarPadding,
        },
        tabBarBackground: () => (
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle:        styles.label,
        tabBarItemStyle:         styles.tabItem,
        sceneStyle:              { backgroundColor: Colors.bgBase },
        tabBarShowLabel:         true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Feather name="message-circle" size={22} color={color} />
              <UnreadDot count={totalUnread} />
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="new-chat"
        options={{
          title: 'New',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Feather name="edit-2" size={22} color={color} />
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Feather name="user" size={22} color={color} />
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:         'absolute',
    borderTopWidth:   StyleSheet.hairlineWidth,
    borderTopColor:   'rgba(255,255,255,0.10)',
    backgroundColor:  'transparent',
    elevation:        0,
  },
  tabItem: {
    paddingTop: 8,
  },
  label: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.3,
    marginTop:     2,
  },
  iconWrapper: {
    alignItems: 'center',
  },
});
