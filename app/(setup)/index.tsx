import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ingestAll } from '../../lib/ingest';
import { buildIdeas } from '../../lib/ideas';
import { clearAllPrompts } from '../../lib/db';
import { useIdeasStore } from '../../state/ideasStore';
import { logDebug } from '../../lib/log';

export default function SetupScreen() {
  const load = useIdeasStore((s) => s.loadFromIngest);

  async function enter() {
    try { clearAllPrompts(); } catch {}
    try { logDebug('[Setup] enter: start ingest'); } catch {}
    const data = await ingestAll();
    try { logDebug(`[Setup] ingest loaded projects=${data.projects.length} messages=${data.messages.length}`); } catch {}
    try {
      await buildIdeas(data.projects, data.messages);
      try { logDebug('[Setup] buildIdeas complete'); } catch {}
    } catch (e) {
      try { logDebug(`[Setup] buildIdeas error: ${(e as Error)?.message ?? String(e)}`); } catch {}
    }
    load({ projects: data.projects, messages: data.messages });
    try { logDebug('[Setup] navigate to /(tabs)/feed'); } catch {}
    router.replace('/(tabs)/feed');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AntiSocial</Text>
      <Text style={styles.subtitle}>
        Using your real ChatGPT history (chat.html) and projects. Processing happens on-device.
      </Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={enter}>
        <Text style={styles.buttonText}>Enter Feed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  subtitle: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: 'rgba(0,232,209,0.26)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#00E8D1',
    fontWeight: '600',
  },
});
