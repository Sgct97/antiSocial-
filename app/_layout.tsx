import { Stack } from 'expo-router';
import React from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import DebugHUD from '../components/DebugHUD';
import { useEffect } from 'react';
import { generatePromptsForIdea } from '../lib/llm';
import { logDebug } from '../lib/log';

function LayoutInner() {
  const insets = useSafeAreaInsets();
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#0B0D10' }}>
      {/* Prewarm model on app start */}
      <Prewarm />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="(setup)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Place HUD after Stack so it renders on top */}
      <DebugHUD />
    </View>
  );
}

function Prewarm() {
  useEffect(() => {
    (async () => {
      try {
        await generatePromptsForIdea('prewarm', 'Prewarm', 'init model', (m) => {
          console.log('[Prewarm]', m);
          try { logDebug(`[Prewarm] ${m}`); } catch {}
        });
      } catch {}
    })();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LayoutInner />
    </SafeAreaProvider>
  );
}
