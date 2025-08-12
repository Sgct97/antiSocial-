import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { subscribe, getBuffer, logDebug } from "../lib/log";

export default function DebugHUD() {
  const [lines, setLines] = useState<string[]>(getBuffer());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Visible confirmation that HUD is mounted
    try { logDebug('[HUD] DebugHUD mounted'); } catch {}
    const unsub = subscribe((line) => {
      setLines((prev) => [...prev.slice(-19), line]);
    });
    return unsub;
  }, []);

  if (!open) return (
    <Pressable style={styles.collapsed} onPress={() => setOpen(true)}>
      <Text style={styles.collapsedText}>Logs</Text>
    </Pressable>
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable onPress={() => setOpen(false)} style={styles.header}>
        <Text style={styles.headerText}>Debug Logs (tap to hide)</Text>
      </Pressable>
      <View style={styles.body}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.line}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 8, right: 8, bottom: 16, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, zIndex: 9999, elevation: 9999 },
  header: { paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.15)" },
  headerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  body: { maxHeight: 180, padding: 8 },
  line: { color: "#C8F6EF", fontSize: 10, lineHeight: 14 },
  collapsed: { position: "absolute", right: 8, bottom: 16, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, zIndex: 9999, elevation: 9999 },
  collapsedText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
