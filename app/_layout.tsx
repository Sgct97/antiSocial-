import { Stack } from 'expo-router';
import React from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="(setup)/index" />
        <Stack.Screen name="(tabs)/feed" />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LayoutInner />
    </SafeAreaProvider>
  );
}
