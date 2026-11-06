import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppProvider } from '../src/state/AppState';
import { useTheme } from '../src/theme';

const WEB_MAX_WIDTH = 480;

/** On the web, centre the app in a phone-width column. Native platforms render it untouched. */
function WebFrame({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    document.body.style.backgroundColor = colors.background;
    document.documentElement.style.colorScheme = scheme;
  }, [colors.background, scheme]);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={[styles.outer, { backgroundColor: colors.background }]}>
      <View style={[styles.inner, { backgroundColor: colors.background }]}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  return (
    <AppProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <WebFrame>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="facility/[id]" />
        </Stack>
      </WebFrame>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH },
});
