import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

/** SF Pro system font includes these symbols on iOS */
export function LayersIcon({ size = 20, color = '#fff' }: IconProps) {
  const s = size * 0.35;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: s * 2.2, height: s * 0.5, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
      <View style={{ width: s * 1.8, height: s * 0.5, backgroundColor: color, borderRadius: 1, marginBottom: 2, opacity: 0.7 }} />
      <View style={{ width: s * 1.4, height: s * 0.5, backgroundColor: color, borderRadius: 1, opacity: 0.5 }} />
    </View>
  );
}

export function StarIcon({ size = 20, color = '#fff', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>
      {filled ? '★' : '☆'}
    </Text>
  );
}

export function TodayIcon({ size = 20, color = '#fff' }: IconProps) {
  const s = size * 0.6;
  const day = new Date().getDate().toString();
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: s, height: s,
        borderWidth: 1.5, borderColor: color, borderRadius: 2,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{ position: 'absolute', top: -0.5, left: s * 0.2, width: 1.5, height: 3, backgroundColor: color, borderRadius: 0.5 }} />
        <View style={{ position: 'absolute', top: -0.5, right: s * 0.2, width: 1.5, height: 3, backgroundColor: color, borderRadius: 0.5 }} />
        <Text style={{ fontSize: s * 0.55, fontWeight: '700', color, marginTop: 2 }}>{day}</Text>
      </View>
    </View>
  );
}

export function ChevronIcon({ size = 16, color = '#48484a' }: IconProps) {
  return (
    <Text style={{ fontSize: size, color, fontWeight: '300' }}>
      ›
    </Text>
  );
}

export function DocumentIcon({ size = 20, color = '#636366' }: IconProps) {
  const s = size * 0.55;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: s, height: s * 1.3,
        borderWidth: 1.5, borderColor: color, borderRadius: 2,
        padding: 2, justifyContent: 'flex-end',
      }}>
        <View style={{ height: 1, backgroundColor: color, marginBottom: 2, opacity: 0.6 }} />
        <View style={{ height: 1, backgroundColor: color, marginBottom: 2, opacity: 0.6 }} />
        <View style={{ height: 1, backgroundColor: color, width: '60%', opacity: 0.6 }} />
      </View>
    </View>
  );
}

export function PersonIcon({ size = 13, color = '#636366' }: IconProps) {
  return (
    <Text style={{ fontSize: size, color }}>⌘</Text>
  );
}

export function ClockIcon({ size = 13, color = '#636366' }: IconProps) {
  const s = size * 0.8;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: s, height: s,
        borderWidth: 1.2, borderColor: color, borderRadius: s / 2,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <View style={{ width: 1, height: s * 0.3, backgroundColor: color, position: 'absolute', top: s * 0.15 }} />
        <View style={{ width: s * 0.25, height: 1, backgroundColor: color, position: 'absolute', right: s * 0.15, top: s * 0.38 }} />
      </View>
    </View>
  );
}

export function BookIcon({ size = 13, color = '#636366' }: IconProps) {
  return (
    <Text style={{ fontSize: size - 1, color }}>📖</Text>
  );
}

export function ExternalLinkIcon({ size = 16, color = '#0a84ff' }: IconProps) {
  return (
    <Text style={{ fontSize: size, color }}>↗</Text>
  );
}

export function AlertIcon({ size = 48, color = '#3a3a3c' }: IconProps) {
  return (
    <Text style={{ fontSize: size, color }}>⚠</Text>
  );
}
