import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Dimensions, ViewToken } from 'react-native';
import { router } from 'expo-router';
import { useIdeasStore } from '../../state/ideasStore';
import { ingestAll } from '../../lib/ingest';
import IdeaCard from '../../components/IdeaCard';

const screenHeight = Math.round(Dimensions.get('window').height);

export default function FeedScreen() {
  const ideas = useIdeasStore((s) => s.ideas);
  const load = useIdeasStore((s) => s.loadFromIngest);
  const [activeId, setActiveId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 90 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
    if (viewableItems[0]?.item?.id) setActiveId(viewableItems[0].item.id as string);
  });

  useEffect(() => {
    ingestAll().then(load).catch(() => {});
  }, [load]);

  return (
    <View className="flex-1 bg-obsidian">
      <FlatList
        data={ideas}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={screenHeight}
        decelerationRate="fast"
        snapToAlignment="start"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: screenHeight, offset: screenHeight * index, index })}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/chat/${item.id}`)} style={{ height: screenHeight }}>
            <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
              <IdeaCard
                title={item.title}
                blurb={item.blurb}
                isActive={activeId === item.id}
              />
            </View>
          </Pressable>
        )}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <Text className="text-neutral-400 text-center">Loading ideas…</Text>
          </View>
        }
      />
    </View>
  );
}
