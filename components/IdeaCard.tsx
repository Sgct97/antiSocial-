import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import CardArt from './CardArt';
import { generatePromptsForIdea } from '../lib/llm';

export type IdeaCardProps = {
  title: string;
  blurb: string;
  hook?: string;
  isActive: boolean;
};

export default function IdeaCard({ title, blurb, hook = 'Let’s make a move →', isActive }: IdeaCardProps) {
  const [prompts, setPrompts] = useState<string[] | null>(null);
  const scale = useSharedValue(0.95);
  const chipOpacity = useSharedValue(0);
  const ctaTranslate = useSharedValue(20);
  const ctaOpacity = useSharedValue(0);
  const idRef = useRef(`${title}|${blurb}`.slice(0, 120));
  useEffect(() => { idRef.current = `${title}|${blurb}`.slice(0, 120); }, [title, blurb]);

  // Only fetch when card becomes active and we don't have prompts yet
  useEffect(() => {
    if (!isActive) return;
    if (prompts !== null) return;
    let cancelled = false;
    generatePromptsForIdea(idRef.current, title, blurb)
      .then((res) => { if (!cancelled) setPrompts(res); })
      .catch(() => { if (!cancelled) setPrompts([]); });
    return () => { cancelled = true; };
  }, [isActive, title, blurb, prompts]);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1 : 0.95, { duration: 200 });
    chipOpacity.value = withDelay(250, withTiming(isActive ? 1 : 0, { duration: 200 }));
    ctaTranslate.value = withTiming(isActive ? 0 : 20, { duration: 200 });
    ctaOpacity.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, scale, chipOpacity, ctaTranslate, ctaOpacity]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const chipStyle = useAnimatedStyle(() => ({ opacity: chipOpacity.value }));
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ctaTranslate.value }], opacity: ctaOpacity.value }));

  const isLoading = prompts === null && isActive;
  const hasPrompts = Array.isArray(prompts) && prompts.length > 0;

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <CardArt seed={title + blurb} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.ring}><Text style={styles.ringText}>0</Text></View>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.blurb}>{blurb}</Text>
        <View style={styles.promptList}>
          {isLoading && <Text style={styles.promptItem}>• Generating prompts…</Text>}
          {!isLoading && hasPrompts && prompts!.map((p, i) => (
            <Text key={i} style={styles.promptItem}>• {p}</Text>
          ))}
          {!isLoading && !hasPrompts && (
            <Text style={styles.promptItem}>• LLM not connected. Open Ollama on 127.0.0.1:11434</Text>
          )}
        </View>
      </View>
      <Animated.View style={[styles.chip, chipStyle]}>
        <Text style={styles.chipText}>{hook}</Text>
      </Animated.View>
      <Animated.View style={[styles.ctaRow, ctaStyle]}>
        <Text style={styles.ctaText}>Tap to open chat</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(18,20,24,0.92)',
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    flex: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700', lineHeight: 32, flex: 1, paddingRight: 8, flexShrink: 1 },
  ring: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00E8D1', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ringText: { color: '#00E8D1', fontSize: 11 },
  textBlock: { flex: 1, justifyContent: 'flex-start' },
  blurb: { color: '#E5E7EB', fontSize: 19, lineHeight: 28 },
  promptList: { marginTop: 14 },
  promptItem: { color: '#C8F6EF', fontSize: 16, lineHeight: 24, marginBottom: 6 },
  chip: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: 'rgba(0,232,209,0.26)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#00E8D1', fontSize: 12, fontWeight: '600' },
  ctaRow: { marginTop: 12 },
  ctaText: { color: '#B0B6BF', fontSize: 13 },
});
