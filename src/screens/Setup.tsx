import React from 'react';
import { View, Text, Pressable, StyleSheet, InteractionManager } from 'react-native';
import { ingestAll } from '../../lib/ingest';
import { buildIdeas } from '../../lib/ideas';
import { useIdeasStore } from '../../state/ideasStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearAllPrompts } from '../../lib/db';

export default function Setup({ onEnter }: { onEnter: () => void }) {
  const load = useIdeasStore((s) => s.loadFromIngest);

  async function enter() {
    // Wipe any cached prompts
    try { clearAllPrompts(); } catch {}

    const data = await ingestAll();
    // Build ideas and populate SQLite (docs + vectors) BEFORE entering feed so RAG works on first render
    try {
      await buildIdeas(data.projects, data.messages);
    } catch {}
    // Load store after build so titles/blurbs are ready while vectors/docs exist
    load({ projects: data.projects, messages: data.messages });
    onEnter();
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>AntiSocial</Text>
        <Text style={styles.subtitle}>
          Using your real ChatGPT history (chat.html) and projects. Processing happens on-device.
        </Text>
        <Pressable style={styles.button} onPress={enter}>
          <Text style={styles.buttonText}>Enter Feed</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D10' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '600', marginBottom: 12 },
  subtitle: { color: '#B0B6BF', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: {
    backgroundColor: 'rgba(0,232,209,0.2)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { color: '#00E8D1', fontWeight: '600' },
});
