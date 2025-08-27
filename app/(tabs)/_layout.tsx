import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0B0D10', borderTopColor: '#111418' },
        tabBarActiveTintColor: '#00E8D1',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color }) => <View style={{ width: 8, height: 8, borderRadius: 0, backgroundColor: color }} />,
        }}
      />
    </Tabs>
  );
}


