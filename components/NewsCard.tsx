import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import CardArt from './CardArt';

export type NewsCardProps = {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  createdAt: number;
  imageUrl?: string | null;
  selfText?: string | null;
  externalUrl?: string | null;
  isActive: boolean;
  onOpen: () => void;
};

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function NewsCard({ id, title, subreddit, score, createdAt, imageUrl, selfText, externalUrl, isActive, onOpen }: NewsCardProps) {
  const scale = useSharedValue(0.96);
  const chipOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1 : 0.96, { duration: 220 });
    chipOpacity.value = withDelay(180, withTiming(isActive ? 1 : 0, { duration: 200 }));
  }, [isActive, scale, chipOpacity]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const chipStyle = useAnimatedStyle(() => ({ opacity: chipOpacity.value }));

  // Dynamic layout sizing to keep cards visually balanced
  const bodyLength = (selfText?.length ?? 0);
  const textScore = Math.max(0, Math.min(1, (bodyLength + title.length * 2) / 800)); // 0..1 (more = denser)
  const imageHeight = Math.round(320 - 140 * textScore); // 320 (short) -> 180 (long)
  const bodyLines = Math.max(8, Math.min(14, Math.round(8 + 6 * textScore)));
  const titleIsLarge = bodyLength < 80;

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Media region */}
      {imageUrl ? (
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.imageWrap, { height: imageHeight }]}>
          <CardArt seed={`${subreddit}:${id}`} />
        </View>
      )}
      {/* Text region */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.pill}><Text style={styles.pillText}>/r/{subreddit}</Text></View>
          <Text style={styles.metaText}>{timeAgo(createdAt)} • {Math.round(score)}↑</Text>
        </View>
        <Text style={[styles.title, titleIsLarge ? styles.titleLarge : null]}>
          {title}
        </Text>
        {selfText ? (
          <Text numberOfLines={bodyLines} style={styles.bodyText}>{selfText}</Text>
        ) : null}
        <Animated.View style={[styles.chip, chipStyle]}>
          <Pressable onPress={onOpen} onLongPress={() => { if (externalUrl) { try { (global as any).openURL?.(externalUrl); } catch {} } }}>
            <LinearGradient colors={["#00E8D1", "#00D4BE"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipGrad}>
              <Text style={styles.chipText}>Open in Reddit →</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(18,20,24,0.92)',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    flex: 1,
  },
  imageWrap: { height: 240 },
  image: { width: '100%', height: '100%' },
  content: { padding: 20, flex: 1, justifyContent: 'space-between' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pill: { backgroundColor: 'rgba(0,232,209,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { color: '#00E8D1', fontSize: 12, fontWeight: '600' },
  metaText: { color: '#9CA3AF', fontSize: 12 },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  titleLarge: { fontSize: 26, lineHeight: 34 },
  chip: { marginTop: 14, alignSelf: 'flex-start', borderRadius: 999 },
  chipGrad: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: '#000000', fontSize: 12, fontWeight: '700' },
  bodyText: { color: '#E5E7EB', fontSize: 18, lineHeight: 26, marginTop: 12 },
});


