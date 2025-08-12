import React, { useRef, useState } from 'react';
import { View, ViewToken, FlatList, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Setup from './src/screens/Setup';
import { useIdeasStore } from './state/ideasStore';
import IdeaCard from './components/IdeaCard';

const screenHeight = Math.round(Dimensions.get('window').height);

export default function App() {
  const [entered, setEntered] = useState(false);
  const ideas = useIdeasStore((s) => s.ideas);
  const [activeId, setActiveId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 90 });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
    if (viewableItems[0]?.item?.id) setActiveId(viewableItems[0].item.id as string);
  });

  if (!entered) {
    return <Setup onEnter={() => setEntered(true)} />;
  }

  return (
    <SafeAreaView style={styles.root}>
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
          <View style={{ height: screenHeight }}>
            <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}>
              <IdeaCard
                id={item.id}
                title={item.title}
                blurb={item.blurb}
                isActive={activeId === item.id}
              />
            </View>
          </View>
        )}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D10' },
});
