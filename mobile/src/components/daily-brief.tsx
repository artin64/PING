import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';

import { PingoIcon, TextBlock } from '@/components/ui';
import { usePingoTheme } from '@/lib/theme';

// Bundled Unsplash photography keeps the daily scene available offline.
const scenes = [
  { title: 'Moraine Lake · Canada', image: require('../../assets/images/hero-alpine-lake.jpg') },
  { title: 'Vernazza · Italy', image: require('../../assets/images/hero-vernazza.jpg') },
  { title: 'Quiet forest lake', image: require('../../assets/images/hero-misty-forest.jpg') },
] as const;

function dateSeed() {
  const today = new Date();
  return Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000) % scenes.length;
}

export function DailyBrief({
  date,
  greeting,
  displayName,
  userInitial,
  attentionCount,
  upcomingCount,
  loading,
  error,
  onCapture,
  onSettings,
}: {
  date: string;
  greeting: string;
  displayName: string;
  userInitial: string;
  attentionCount: number;
  upcomingCount: number;
  loading: boolean;
  error: boolean;
  onCapture: () => void;
  onSettings: () => void;
}) {
  const colors = usePingoTheme();
  const [sceneIndex, setSceneIndex] = useState(dateSeed);
  const [previousSceneIndex, setPreviousSceneIndex] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sceneIndexRef = useRef(sceneIndex);
  const fade = useRef(new Animated.Value(1)).current;
  const zoom = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReduceMotion(enabled); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const changeScene = useCallback((next: number) => {
    if (next === sceneIndexRef.current) return;
    const previous = sceneIndexRef.current;
    sceneIndexRef.current = next;
    setSceneIndex(next);
    fade.stopAnimation();
    if (reduceMotion) {
      setPreviousSceneIndex(null);
      fade.setValue(1);
      return;
    }
    setPreviousSceneIndex(previous);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 1_100, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setPreviousSceneIndex(null);
    });
  }, [fade, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const interval = setInterval(() => changeScene((sceneIndexRef.current + 1) % scenes.length), 45_000);
    return () => clearInterval(interval);
  }, [changeScene, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      zoom.setValue(1);
      return undefined;
    }
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(zoom, { toValue: 1.045, duration: 24_000, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1.015, duration: 24_000, useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [reduceMotion, zoom]);

  const message = error
    ? 'Your overview could not load. Retry below.'
    : loading
      ? 'Checking what needs your attention…'
      : attentionCount === 0
        ? 'You’re clear for today.'
        : attentionCount === 1
          ? 'One thing needs your attention.'
          : `${attentionCount} things need your attention.`;

  return (
    <View style={styles.hero}>
      {previousSceneIndex !== null ? <Animated.Image
        source={scenes[previousSceneIndex].image}
        resizeMode="cover"
        accessibilityLabel={`Scenic background: ${scenes[sceneIndex].title}`}
        style={[styles.photo, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: zoom }] }]}
      /> : null}
      <Animated.Image
        source={scenes[sceneIndex].image}
        resizeMode="cover"
        accessibilityLabel={`Scenic background: ${scenes[sceneIndex].title}`}
        style={[styles.photo, { opacity: previousSceneIndex === null ? 1 : fade, transform: [{ scale: zoom }] }]}
      />
      <View pointerEvents="none" style={styles.scrim} />
      <View pointerEvents="none" style={styles.bottomWash} />
      <View pointerEvents="none" style={styles.bottomWashMid} />
      <View pointerEvents="none" style={styles.bottomWashLower} />
      <View pointerEvents="none" style={styles.bottomWashEdge} />

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><TextBlock color="#0B2035" style={styles.brandLetter}>P</TextBlock></View>
          <View>
            <TextBlock color="#FFFFFF" style={styles.brandName}>PINGO</TextBlock>
            <TextBlock size="eyebrow" color="#E3ECF4" style={styles.tagline}>NEVER MISS WHAT MATTERS</TextBlock>
          </View>
        </View>
        <Pressable onPress={onSettings} accessibilityRole="button" accessibilityLabel="Account settings" style={({ pressed }) => [styles.profileButton, pressed && { opacity: 0.7 }]}>
          <TextBlock size="small" color="#FFFFFF" style={{ fontWeight: '700' }}>{userInitial}</TextBlock>
          <PingoIcon name="settings" size={14} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.greetingBlock}>
        <TextBlock size="eyebrow" color="#F5D58A" style={styles.date}>{date.toUpperCase()}</TextBlock>
        <TextBlock size="title" color="#FFFFFF" style={styles.greeting}>{greeting}{displayName ? `, ${displayName}.` : '.'}</TextBlock>
        <TextBlock size="small" color="#EDF4F9" style={styles.greetingNote}>A clearer view of what matters today.</TextBlock>
      </View>

      <View style={styles.summary}>
        <View style={styles.countBlock}>
          <TextBlock size="eyebrow" color="#D8E7F4">IN FOCUS</TextBlock>
          <TextBlock style={styles.count}>{loading || error ? '—' : String(attentionCount)}</TextBlock>
        </View>
        <View style={styles.copy}>
          <TextBlock size="heading" color="#FFFFFF" style={{ fontWeight: '600' }}>{message}</TextBlock>
          <TextBlock size="small" color="#E3ECE7" style={{ marginTop: 5 }}>
            {attentionCount > 0 && !loading && !error
              ? 'Payments and important dates, gathered in one calm view.'
              : 'Your saved reminders are here when you need them.'}
          </TextBlock>
        </View>
      </View>

      <View style={styles.sceneRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.sceneTitleRow}>
            <PingoIcon name="photo" size={14} color={colors.blue} />
            <TextBlock size="eyebrow" color="#D8E7F4">SCENE OF THE DAY</TextBlock>
          </View>
          <TextBlock size="small" color="#FFFFFF" numberOfLines={1} style={{ marginTop: 3, fontWeight: '600' }}>{scenes[sceneIndex].title}</TextBlock>
        </View>
        <View style={styles.sceneControls} accessibilityLabel="Daily background scenes">
          {scenes.map((scene, index) => (
            <Pressable
              key={scene.title}
              accessibilityRole="button"
              accessibilityLabel={`Show ${scene.title}`}
              accessibilityState={{ selected: sceneIndex === index }}
              onPress={() => changeScene(index)}
              style={({ pressed }) => [styles.sceneDotTap, pressed && { opacity: 0.76, transform: [{ scale: 0.94 }] }]}
            >
              <View style={[styles.sceneDot, { width: sceneIndex === index ? 20 : 7, backgroundColor: sceneIndex === index ? '#73BEFF' : 'rgba(255,255,255,0.68)' }]} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.upcoming}>
          <PingoIcon name="clock" size={16} color="#F5D58A" />
          <TextBlock size="small" color="#F4F7FA">{upcomingCount} coming up</TextBlock>
        </View>
        <Pressable onPress={onCapture} accessibilityRole="button" style={({ pressed }) => [styles.capture, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}>
          <PingoIcon name="add" size={16} color="#071911" />
          <TextBlock size="small" color="#071911" style={{ fontWeight: '700' }}>Capture</TextBlock>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 500, marginHorizontal: -21, marginTop: -14, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#0A1C2C' },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 20, 36, 0.25)' },
  bottomWash: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, backgroundColor: 'rgba(4, 15, 29, 0.06)' },
  bottomWashMid: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 225, backgroundColor: 'rgba(4, 15, 29, 0.05)' },
  bottomWashLower: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 155, backgroundColor: 'rgba(4, 15, 29, 0.05)' },
  bottomWashEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 95, backgroundColor: 'rgba(4, 15, 29, 0.04)' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F5D58A', alignItems: 'center', justifyContent: 'center' },
  brandLetter: { fontSize: 22, lineHeight: 25, fontWeight: '900', letterSpacing: -1 },
  brandName: { fontSize: 16, lineHeight: 19, fontWeight: '800', letterSpacing: 2.5 },
  tagline: { fontSize: 9, lineHeight: 12, letterSpacing: 0.65, marginTop: 2 },
  profileButton: { minHeight: 44, minWidth: 68, paddingHorizontal: 8, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(5, 17, 30, 0.46)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  greetingBlock: { marginTop: 12 },
  date: { letterSpacing: 1.5, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 9, textShadowOffset: { width: 0, height: 1 } },
  greeting: { marginTop: 7, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.58)', textShadowRadius: 13, textShadowOffset: { width: 0, height: 2 } },
  greetingNote: { marginTop: 4, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, marginBottom: 5 },
  countBlock: { width: 76 },
  count: { color: '#FFD276', fontSize: 56, lineHeight: 61, fontWeight: '800', letterSpacing: -1.8, marginTop: 3, textShadowColor: 'rgba(9,20,35,0.65)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  copy: { flex: 1, paddingRight: 2 },
  sceneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.28)' },
  sceneTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sceneControls: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  sceneDotTap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sceneDot: { height: 7, borderRadius: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  upcoming: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(5,17,30,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.23)' },
  capture: { minHeight: 44, paddingHorizontal: 17, borderRadius: 22, backgroundColor: '#45E2A1', flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#051A27', shadowOpacity: 0.27, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
});
