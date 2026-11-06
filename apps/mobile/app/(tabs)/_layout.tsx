import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  outline,
  filled,
  focused,
}: {
  outline: IconName;
  filled: IconName;
  focused: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={focused ? filled : outline}
      size={24}
      color={focused ? colors.accent : colors.textTertiary}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Nearby',
          tabBarAccessibilityLabel: 'Nearby services',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="location-outline" filled="location" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          tabBarAccessibilityLabel: 'Ask a question',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              outline="chatbubble-ellipses-outline"
              filled="chatbubble-ellipses"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="settings-outline" filled="settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
