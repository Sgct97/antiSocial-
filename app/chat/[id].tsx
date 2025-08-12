import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ensureChatTables, getMessages, upsertThread } from '../../lib/db';
import { continueThread } from '../../lib/llm';
import { logDebug } from '../../lib/log';

type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number };

export default function ChatScreen() {
  const { id, title: paramTitle, blurb: paramBlurb } = useLocalSearchParams<{ id: string; title?: string; blurb?: string }>();
  const threadId = String(id || '');
  const [title, setTitle] = useState<string>('');
  const blurbRef = useRef<string>(typeof paramBlurb === 'string' ? paramBlurb : '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const containerHeight = useMeasuredContainerHeight();

  useEffect(() => {
    if (!threadId) return;
    try { ensureChatTables(); } catch {}
    // Title: use the first part of id as fallback; real title is set by caller via upsertThread
    try {
      const t = upsertThread({ id: threadId, title: (typeof paramTitle === 'string' && paramTitle) ? paramTitle : `Idea ${threadId}` });
      setTitle(t.title);
      logDebug(`[Chat] thread ready id=${t.id} title=${t.title}`);
    } catch {}
    loadMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, paramTitle]);

  const loadMessages = useCallback(() => {
    try {
      const rows = getMessages(threadId);
      setMessages(rows as ChatMessage[]);
      logDebug(`[Chat] messages fetched count=${rows.length}`);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      logDebug(`[Chat] messages fetch error: ${(e as Error)?.message ?? String(e)}`);
    }
  }, [threadId]);

  const send = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      // Optimistically append user message
      setMessages((prev) => {
        const now = Date.now();
        const temp: ChatMessage = { id: `local_${now}`, role: 'user', content: text, createdAt: now };
        return [...prev, temp];
      });
      listRef.current?.scrollToEnd({ animated: true });
      const reply = await continueThread(threadId, text, { title: title || `Idea ${threadId}`, blurb: blurbRef.current || '' }, (m) => logDebug(m));
      // Reload to reflect persisted messages (user + assistant)
      loadMessages();
      logDebug(`[Chat] assistant reply len=${reply.length}`);
    } catch (e) {
      logDebug(`[Chat] send error: ${(e as Error)?.message ?? String(e)}`);
      loadMessages();
    } finally {
      setSending(false);
    }
  }, [input, sending, threadId, title, loadMessages]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={isUser ? styles.userText : styles.assistantText}>{item.content}</Text>
        </View>
      </View>
    );
  }, []);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container]} onLayout={() => { /* measured by parent */ }}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{title || `Idea ${threadId}`}</Text>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { minHeight: containerHeight - 120 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.composerRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            placeholderTextColor="#7C7F86"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable disabled={sending || !input.trim()} onPress={send} style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}>
            <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function useMeasuredContainerHeight() {
  const [h, setH] = useState<number>(Math.round(Dimensions.get('window').height));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setH(Math.round(window.height)));
    return () => sub.remove();
  }, []);
  return h;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0D10' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  header: { paddingBottom: 10 },
  title: { color: 'white', fontSize: 18, fontWeight: '700' },
  listContent: { paddingVertical: 8 },
  bubbleRow: { flexDirection: 'row', marginVertical: 6, paddingHorizontal: 4 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  assistantBubble: { backgroundColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 2 },
  userBubble: { backgroundColor: 'rgba(0,232,209,0.22)', borderTopRightRadius: 2 },
  assistantText: { color: '#E5E7EB', fontSize: 15, lineHeight: 21 },
  userText: { color: '#C8F6EF', fontSize: 15, lineHeight: 21 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  sendBtn: { backgroundColor: 'rgba(0,232,209,0.26)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { color: '#00E8D1', fontWeight: '700' },
});
