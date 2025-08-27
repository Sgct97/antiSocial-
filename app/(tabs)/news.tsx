import React, { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, Dimensions, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, Linking, Pressable } from 'react-native';
import { getTopNewsPosts, NewsPost } from '../../lib/news';
import { logDebug } from '../../lib/log';
import NewsCard from '../../components/NewsCard';
import { clearNewsCache } from '../../lib/db';

const screenHeight = Math.round(Dimensions.get('window').height);

export default function NewsScreen() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(screenHeight);
  const [refreshing, setRefreshing] = useState(false);
  const didUserScrollRef = useRef(false);
  const onScrollSettled = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!didUserScrollRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    const h = containerHeight || screenHeight;
    const index = Math.max(0, Math.floor((y + h * 0.3) / h));
    const next = posts[index]?.id as string | undefined;
    if (!next) return;
    if (next !== activeId) {
      const line = `[News] snap settle index=${index} id=${next}`;
      try { logDebug(line); } catch {}
      setActiveId(next);
    }
  };

  const load = useCallback(async (force?: boolean) => {
    try {
      const data = await getTopNewsPosts({ forceRefresh: !!force, limitPerSub: 10, totalLimit: 60 });
      setPosts(data);
    } catch (e) {
      try { logDebug(`[News] load error: ${(e as Error)?.message ?? String(e)}`); } catch {}
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  useLayoutEffect(() => {
    if (posts.length === 0) return;
    setActiveId((prev) => {
      const hasPrev = !!prev && posts.some((x) => x.id === prev);
      if (hasPrev) return prev!;
      const next = posts[0].id;
      try { logDebug(`[News] activeId set id=${next}`); } catch {}
      return next;
    });
  }, [posts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  return (
    <View
      className="flex-1 bg-obsidian"
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h && h !== containerHeight) {
          setContainerHeight(h);
          try { logDebug(`[News] measured containerHeight=${h}`); } catch {}
        }
      }}
    >
      {/* Hidden clear-refresh area: long-press at top to wipe cache and refetch */}
      <Pressable
        onLongPress={async () => {
          try { clearNewsCache(); logDebug('[News] cache cleared'); } catch {}
          await load(true);
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, zIndex: 1 }}
      >
        <View />
      </Pressable>
      <FlatList
        key={containerHeight}
        data={posts}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={containerHeight}
        decelerationRate="fast"
        snapToAlignment="start"
        initialNumToRender={3}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        bounces
        alwaysBounceVertical
        refreshing={refreshing}
        onRefresh={onRefresh}
        getItemLayout={(_, index) => ({ length: containerHeight, offset: containerHeight * index, index })}
        renderItem={({ item, index }) => {
          const isActive = activeId ? activeId === item.id : index === 0;
          return (
            <Pressable onPress={() => Linking.openURL(item.url)} style={{ height: containerHeight }}>
              <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
                <NewsCard
                  id={item.id}
                  title={item.title}
                  subreddit={item.subreddit}
                  score={item.score}
                  createdAt={item.createdAt}
                  imageUrl={item.imageUrl}
                  selfText={item.selfText}
                  externalUrl={(item as any).externalUrl}
                  isActive={isActive}
                  onOpen={() => Linking.openURL(item.url)}
                />
              </View>
            </Pressable>
          );
        }}
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
        onScrollBeginDrag={() => { didUserScrollRef.current = true; }}
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <Text className="text-neutral-400 text-center">Loading news…</Text>
          </View>
        }
      />
    </View>
  );
}


