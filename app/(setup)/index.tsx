import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ingestAll } from '../../lib/ingest';
import { buildIdeas } from '../../lib/ideas';
import { useIdeasStore } from '../../state/ideasStore';

export default function SetupScreen() {
  const load = useIdeasStore((s) => s.loadFromIngest);

  async function enter() {
    const data = await ingestAll();
    // Build ideas via pipeline in background; fallback to simple merge via store load
    buildIdeas(data.projects, data.messages)
      .then((ideas) => load({ projects: data.projects, messages: data.messages }))
      .catch(() => load(data));
    router.replace('/(tabs)/feed');
  }

  return (
    <View className="flex-1 bg-obsidian items-center justify-center p-lg">
      <Text className="text-white text-xl font-semibold mb-md">AntiSocial</Text>
      <Text className="text-neutral-300 text-sm mb-lg text-center">
        Using your real ChatGPT history (chat.html) and projects. Processing happens on-device.
      </Text>
      <Pressable className="bg-electric/20 rounded-button px-lg py-sm" onPress={enter}>
        <Text className="text-electric font-medium">Enter Feed</Text>
      </Pressable>
    </View>
  );
}
