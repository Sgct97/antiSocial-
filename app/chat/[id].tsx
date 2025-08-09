import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getDb } from '../../lib/db';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [context, setContext] = useState<string[]>([]);

  useEffect(() => {
    // Simple context fetch: take any doc whose id starts with the idea marker when kmeans ran (k0, k1...).
    // If vectors exist, we could improve this by retrieving via centroid, but keeping simple for MVP.
    try {
      const db = getDb();
      const rows = db.getAllSync<{ text: string }>('SELECT text FROM docs LIMIT 5');
      setContext(rows.map((r) => r.text));
    } catch {
      setContext([]);
    }
  }, [id]);

  return (
    <View className="flex-1 bg-obsidian p-lg">
      <Text className="text-white text-lg font-semibold mb-md">Idea {id}</Text>
      <ScrollView className="mb-lg" style={{ maxHeight: 240 }}>
        {context.length > 0 ? (
          <Text className="text-neutral-300">
            {context.slice(0, 3).map((t, i) => `• ${t}\n`).join('')}
          </Text>
        ) : (
          <Text className="text-neutral-500">No context yet. It will populate after initial processing.</Text>
        )}
      </ScrollView>
      <Text className="text-neutral-200 mb-lg">Question: What is the single smallest next step that meaningfully advances this idea today?</Text>
      <Pressable className="bg-electric/20 rounded-button px-lg py-sm self-start" onPress={() => router.back()}>
        <Text className="text-electric font-medium">Done</Text>
      </Pressable>
    </View>
  );
}
