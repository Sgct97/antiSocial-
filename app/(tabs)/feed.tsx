import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, Pressable, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import { useIdeasStore } from '../../state/ideasStore';
import IdeaCard from '../../components/IdeaCard';
import { logDebug } from '../../lib/log';
import { getCachedPrompts } from '../../lib/db';
import { generatePromptsForIdea } from '../../lib/llm';

const screenHeight = Math.round(Dimensions.get('window').height);

export default function FeedScreen() {
  const ideas = useIdeasStore((s) => s.ideas);
  const load = useIdeasStore((s) => s.loadFromIngest);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Measure actual viewport height of the list container to avoid first-frame
  // safe-area offset issues on iOS. Use this everywhere for snapping and item layout.
  const [containerHeight, setContainerHeight] = useState<number>(screenHeight);
  // We avoid first-frame races by driving activation from scroll snapping
  const scrollSettle = useRef({ lastIndex: 0 });
  const didUserScrollRef = useRef(false);
  const activationUnlockedRef = useRef(false);
  const prefetchOnceRef = useRef(false);
  const onScrollSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!didUserScrollRef.current) {
      // Ignore any initial settle events before the user actually scrolls
      return;
    }
    const y = e.nativeEvent.contentOffset.y;
    // Bias toward index 0 to ignore tiny initial offsets
    const h = containerHeight || screenHeight;
    const index = Math.max(0, Math.floor((y + h * 0.3) / h));
    const next = ideas[index]?.id as string | undefined;
    if (!next) return;
    if (next !== activeId) {
      const line = `[Feed] snap settle index=${index} id=${next}`;
      console.log(line);
      try { logDebug(line); } catch {}
      setActiveId(next);
      scrollSettle.current.lastIndex = index;
    }
  };

  // Do NOT ingest here. Setup screen performs ingest/build and populates store.

  // Keep active card stable when ideas change: if current activeId is missing, pick first.
  useLayoutEffect(() => {
    if (ideas.length === 0) return;
    setActiveId((prev) => {
      const hasPrev = !!prev && ideas.some((x) => x.id === prev);
      if (hasPrev) return prev!;
      const next = ideas[0].id;
      const reason = prev ? 'prev_missing_reset_to_first' : 'initial_set_to_first';
      const line = `[Feed] activeId set id=${next} reason=${reason}`;
      console.log(line);
      try { logDebug(line); } catch {}
      return next;
    });
  }, [ideas]);

  // One-time prefetch for the first idea to avoid first-frame activation race.
  useEffect(() => {
    if (ideas.length === 0) return;
    if (prefetchOnceRef.current) return;
    prefetchOnceRef.current = true;
    const first = ideas[0];
    try {
      const cached = getCachedPrompts(first.id);
      if (cached && cached.length >= 3) {
        logDebug(`[Feed] prefetch: cache hit for ${first.id} count=${cached.length}`);
        return;
      }
    } catch {}
    (async () => {
      try {
        logDebug(`[Feed] prefetch: warm prompts for ${first.id}`);
        await generatePromptsForIdea(first.id, first.title, first.blurb, (m) => logDebug(m));
        logDebug(`[Feed] prefetch: done for ${first.id}`);
      } catch (e) {
        logDebug(`[Feed] prefetch: failed for ${first.id} err=${(e as Error)?.message ?? String(e)}`);
      }
    })();
  }, [ideas]);

  return (
    <View
      className="flex-1 bg-obsidian"
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h && h !== containerHeight) {
          setContainerHeight(h);
          try { logDebug(`[Feed] measured containerHeight=${h}`); } catch {}
        }
      }}
    >
      <FlatList
        key={containerHeight}
        data={ideas}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={containerHeight}
        decelerationRate="fast"
        snapToAlignment="start"
        initialNumToRender={3}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        getItemLayout={(_, index) => ({ length: containerHeight, offset: containerHeight * index, index })}
        renderItem={({ item, index }) => {
          const active = !activationUnlockedRef.current && index === 0
            ? true
            : activeId
              ? activeId === item.id
              : index === 0;
          if (index === 0) {
            const line = `[Feed] render first card active=${String(active)} activeId=${activeId ?? 'null'}`;
            console.log(line);
            try { logDebug(line); } catch {}
          }
          const rootId = item.id.split('_')[0];
          return (
            <Pressable onPress={() => router.push({ pathname: `/chat/${rootId}`, params: { title: item.title, blurb: item.blurb } })} style={{ height: containerHeight }}>
              <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
                <IdeaCard
                  id={item.id}
                  title={item.title}
                  blurb={item.blurb}
                  isActive={active}
                  onFirstActivate={index === 0 ? () => { activationUnlockedRef.current = true; } : undefined}
                />
              </View>
            </Pressable>
          );
        }}
        // Drive activation deterministically from snap settling
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
        onScrollBeginDrag={() => { didUserScrollRef.current = true; }}
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <Text className="text-neutral-400 text-center">Loading ideas…</Text>
          </View>
        }
      />
    </View>
  );
}
