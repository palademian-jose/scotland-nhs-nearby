import { Tabs } from 'expo-router';

import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Nearby', tabBarAccessibilityLabel: 'Nearby services' }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: 'Ask', tabBarAccessibilityLabel: 'Ask a question' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarAccessibilityLabel: 'Settings' }}
      />
    </Tabs>
  );
}
