import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import CardArt from './CardArt';
import { generatePromptsForIdea } from '../lib/llm';
import { getCachedPrompts } from '../lib/db';
import { logDebug } from '../lib/log';

export type IdeaCardProps = {
  id: string;
  title: string;
  blurb: string;
  hook?: string;
  isActive: boolean;
  onFirstActivate?: () => void;
};

export default function IdeaCard({ id, title, blurb, hook = 'Let’s make a move →', isActive, onFirstActivate }: IdeaCardProps) {
  const [prompts, setPrompts] = useState<string[] | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const scale = useSharedValue(0.95);
  const chipOpacity = useSharedValue(0);
  const ctaTranslate = useSharedValue(20);
  const ctaOpacity = useSharedValue(0);
  const idRef = useRef(id);
  const attemptsRef = useRef(0);
  const loadingRef = useRef(false);
  const hasActivatedOnceRef = useRef(false);
  const onFirstActivateRef = useRef(onFirstActivate);
  useEffect(() => { onFirstActivateRef.current = onFirstActivate; }, [onFirstActivate]);
  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { attemptsRef.current = 0; setPrompts(null); }, [id, title, blurb]);

  // Load cached prompts immediately if available so bullets appear without waiting for activation
  useEffect(() => {
    try {
      const cached = getCachedPrompts(idRef.current);
      if (cached && cached.length >= 3) {
        setPrompts(cached);
        const line = `[IdeaCard] cache hit id=${idRef.current} count=${cached.length}`;
        try { logDebug(line); } catch {}
        setDebug((d) => [...d.slice(-6), line]);
      }
    } catch {}
  }, [id]);

  // Fetch when active card becomes visible
  useEffect(() => {
    if (isActive && !hasActivatedOnceRef.current) {
      hasActivatedOnceRef.current = true;
      try { onFirstActivateRef.current?.(); } catch {}
    }
    if (!isActive) return;
    if (loadingRef.current) return;
    let cancelled = false;
    loadingRef.current = true;
    (async () => {
      let result: string[] = [];
      attemptsRef.current = 0;
      // Emit immediate log line to HUD so we know we entered generation
      try { logDebug(`[IdeaCard] start id=${idRef.current}`); } catch {}
      while (!cancelled && attemptsRef.current < 3) {
        const line = `[IdeaCard] gen attempt ${attemptsRef.current + 1} id=${idRef.current}`;
        console.log(line);
        logDebug(line);
        setDebug((d) => [...d.slice(-6), line]);
        try {
           const res = await generatePromptsForIdea(idRef.current, title, blurb, (msg) => setDebug((d) => [...d.slice(-6), msg]));
          if (Array.isArray(res) && res.length > 0) { result = res; break; }
        } catch {}
        attemptsRef.current += 1;
        if (attemptsRef.current < 3) await new Promise((r) => setTimeout(r, 1000));
      }
      const finalLine = `[IdeaCard] attempts=${attemptsRef.current} resultCount=${result.length}`;
      console.log(finalLine);
      logDebug(finalLine);
      setDebug((d) => [...d.slice(-6), finalLine]);
      if (!cancelled) setPrompts(result);
      loadingRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [isActive, title, blurb]);

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
            <Text style={styles.promptItem}>• Waiting for prompt generation…</Text>
          )}
        </View>
      </View>
      <Animated.View style={[styles.chip, chipStyle]}>
        <Pressable onPress={() => router.push(`/chat/${id}`)}>
          <Text style={styles.chipText}>{hook}</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.ctaRow, ctaStyle]}>
        <Text style={styles.ctaText}>Tap to open chat</Text>
      </Animated.View>
      <View style={styles.debugBox}>
        {debug.length === 0 ? (
          <Text style={styles.debugText}>[IdeaCard] awaiting logs… isActive={String(isActive)}</Text>
        ) : (
          debug.map((l, i) => (
            <Text key={i} style={styles.debugText}>{l}</Text>
          ))
        )}
      </View>
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
  debugBox: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 8 },
  debugText: { color: '#9CA3AF', fontSize: 10, lineHeight: 14 },
});
