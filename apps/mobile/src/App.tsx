import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FocusSessionScreen from './screens/FocusSessionScreen';
import SyllabusScreen from './screens/SyllabusScreen';
import DevPanelScreen from './screens/DevPanelScreen';
import { useSyllabusStore } from './store/syllabusStore';
import { initClock } from './sync/clock';
import { getOnline, startSyncLoop } from './sync/syncEngine';
import { DEVICE_ID } from './config';
import { colors, radius, space, type } from './theme';

type TabKey = 'focus' | 'syllabus' | 'dev';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'focus', label: 'Focus', icon: '◴' },
  { key: 'syllabus', label: 'Syllabus', icon: '◫' },
  { key: 'dev', label: 'Dev Panel', icon: '⚙' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('focus');
  const [online, setOnlineState] = useState(true);
  const loadSubjects = useSyllabusStore((s) => s.loadSubjects);

  useEffect(() => {
    async function boot() {
      await loadSubjects();
      await initClock();
      startSyncLoop();
    }
    void boot();
  }, [loadSubjects]);

  useEffect(() => {
    const id = setInterval(() => setOnlineState(getOnline()), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>Alcovia</Text>
          <Text style={styles.deviceLine}>{DEVICE_ID}</Text>
        </View>
        <View style={[styles.pill, online ? styles.pillOnline : styles.pillOffline]}>
          <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.pillText, online ? styles.pillTextOnline : styles.pillTextOffline]}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {tab === 'focus' && <FocusSessionScreen />}
        {tab === 'syllabus' && <SyllabusScreen />}
        {tab === 'dev' && <DevPanelScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <View style={[styles.tabInner, active && styles.tabInnerActive]}>
                <Text style={[styles.tabIcon, active && styles.tabTextActive]}>{t.icon}</Text>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.bg,
  },
  wordmark: { ...type.h1, color: colors.ink },
  deviceLine: { ...type.small, color: colors.muted, marginTop: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillOnline: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  pillOffline: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: colors.online },
  dotOffline: { backgroundColor: colors.offline },
  pillText: { ...type.label },
  pillTextOnline: { color: colors.online },
  pillTextOffline: { color: colors.offline },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabInner: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  tabInnerActive: { backgroundColor: colors.accentSoft },
  tabIcon: { fontSize: 18, color: colors.muted },
  tabText: { ...type.small, color: colors.muted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
});
