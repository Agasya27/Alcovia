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

type TabKey = 'focus' | 'syllabus' | 'dev';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'focus', label: '🎯 Focus' },
  { key: 'syllabus', label: '📚 Syllabus' },
  { key: 'dev', label: '🛠 Dev Panel' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('focus');
  const [online, setOnlineState] = useState(true);
  const loadSubjects = useSyllabusStore((s) => s.loadSubjects);

  useEffect(() => {
    async function boot() {
      await loadSubjects(); // loads state from storage, seeding if needed
      await initClock(); // restore Lamport clock from stored operations
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
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alcovia — Device: {DEVICE_ID}</Text>
        <View style={[styles.pill, online ? styles.pillOnline : styles.pillOffline]}>
          <Text style={styles.pillText}>{online ? '● Online' : '● Offline'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {tab === 'focus' && <FocusSessionScreen />}
        {tab === 'syllabus' && <SyllabusScreen />}
        {tab === 'dev' && <DevPanelScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  pillOnline: { backgroundColor: '#dcfce7' },
  pillOffline: { backgroundColor: '#fee2e2' },
  pillText: { fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderTopWidth: 2, borderTopColor: '#4f46e5' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  tabTextActive: { color: '#4f46e5' },
});
