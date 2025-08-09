import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { View } from 'react-native';

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function pick(seed: number, min: number, max: number) {
  const r = (Math.sin(seed) + 1) / 2; // [0,1]
  return min + r * (max - min);
}

export default function CardArt({ seed }: { seed: string }) {
  const params = useMemo(() => {
    const h = hashString(seed);
    const c1 = '#00E8D1';
    const c2 = '#14161B';
    const c3 = '#0B0D10';
    const r1 = pick(h, 40, 120);
    const r2 = pick(h * 1.7, 30, 100);
    const x1 = pick(h * 2.3, 40, 260);
    const y1 = pick(h * 3.1, 40, 140);
    const x2 = pick(h * 4.7, 100, 300);
    const y2 = pick(h * 5.9, 100, 200);
    return { c1, c2, c3, r1, r2, x1, y1, x2, y2 };
  }, [seed]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
      <Svg width="100%" height="100%" viewBox="0 0 360 240">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={params.c3} />
            <Stop offset="100%" stopColor={params.c2} />
          </LinearGradient>
          <LinearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={params.c1} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={params.c1} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="240" fill="url(#bg)" />
        <Circle cx={params.x1} cy={params.y1} r={params.r1} fill="url(#glow)" />
        <Circle cx={params.x2} cy={params.y2} r={params.r2} fill="url(#glow)" />
      </Svg>
    </View>
  );
}
