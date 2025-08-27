import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Linking } from 'react-native';
import { getTopNewsPosts, NewsPost, refreshNewsCache } from '../../lib/news';
import { logDebug } from '../../lib/log';

export default function NewsScreen() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force?: boolean) => {
    try {
      const data = await getTopNewsPosts({ forceRefresh: !!force, limitPerSub: 10, totalLimit: 60 });
      setPosts(data);
    } catch (e) {
      try { logDebug(`[News] load error: ${(e as Error)?.message ?? String(e)}`); } catch {}
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  return (
    <View className="flex-1 bg-obsidian">
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E8D1" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <Text className="text-neutral-400 text-center">Loading news…</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => Linking.openURL(item.url)} style={{ marginBottom: 12 }}>
            <View style={{ backgroundColor: '#0F1216', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#12161B' }}>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 6 }}>/r/{item.subreddit} • {Math.round(item.score)}↑</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }}>{item.title}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}


