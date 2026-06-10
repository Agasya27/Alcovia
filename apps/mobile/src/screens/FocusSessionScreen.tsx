import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../store/sessionStore';
import { useStateStore } from '../store/stateStore';
import type { FocusSession } from '../types';

const DURATION_OPTIONS = [25, 30, 45, 60, 90, 120];

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function FocusSessionScreen() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);
  const completeSession = useSessionStore((s) => s.completeSession);
  const failSession = useSessionStore((s) => s.failSession);

  const student = useStateStore((s) => s.student);
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [toast, setToast] = useState<string | null>(null);

  const recentSessions = useMemo<FocusSession[]>(() => {
    const sessions = student?.sessions ?? [];
    return [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);
  }, [student?.sessions]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function onComplete() {
    await completeSession();
    const s = useStateStore.getState().student;
    showToast(`+50 coins! Streak: ${s?.streak ?? 0} days`);
  }

  function onGiveUp() {
    if (typeof window !== 'undefined' && !window.confirm('Give up this session? No reward will be granted.')) {
      return;
    }
    void failSession('give_up');
  }

  const canComplete =
    !!activeSession && activeSession.elapsedSeconds >= activeSession.targetDuration;
  const remaining = activeSession
    ? activeSession.targetDuration - activeSession.elapsedSeconds
    : 0;
  const progress = activeSession
    ? Math.min(1, activeSession.elapsedSeconds / activeSession.targetDuration)
    : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statsBar}>
        <Text style={styles.statText}>🔥 Streak: {student?.streak ?? 0} days</Text>
        <Text style={styles.statText}>💰 Coins: {student?.coins ?? 0}</Text>
        <Text style={styles.statText}>⏱ Today: {student?.todayFocusMinutes ?? 0} min</Text>
      </View>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {!activeSession ? (
        <View>
          <Text style={styles.sectionTitle}>Choose a duration</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((min) => (
              <Pressable
                key={min}
                style={[styles.durationChip, selectedMinutes === min && styles.durationChipActive]}
                onPress={() => setSelectedMinutes(min)}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    selectedMinutes === min && styles.durationChipTextActive,
                  ]}
                >
                  {min}m
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.startButton}
            onPress={() => startSession(selectedMinutes * 60)}
          >
            <Text style={styles.startButtonText}>Start Session</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Recent sessions</Text>
          {recentSessions.length === 0 && (
            <Text style={styles.muted}>No sessions yet. Start your first focus session!</Text>
          )}
          {recentSessions.map((s) => (
            <View key={s.id} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>
                {new Date(s.startedAt).toLocaleString()} · {Math.round(s.targetDuration / 60)}m
              </Text>
              <View
                style={[
                  styles.badge,
                  s.status === 'completed' ? styles.badgeOk : styles.badgeFail,
                ]}
              >
                <Text style={styles.badgeText}>
                  {s.status === 'completed' ? 'completed' : `failed (${s.failReason ?? 'failed'})`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.runningWrap}>
          <Text style={styles.countdown}>{formatMMSS(remaining)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          {canComplete ? (
            <Text style={styles.readyText}>You can now complete!</Text>
          ) : (
            <Text style={styles.muted}>Stay focused — keep this screen in the foreground.</Text>
          )}

          <Pressable
            style={[styles.completeButton, !canComplete && styles.disabledButton]}
            disabled={!canComplete}
            onPress={onComplete}
          >
            <Text style={styles.completeButtonText}>Complete</Text>
          </Pressable>

          <Pressable style={styles.giveUpButton} onPress={onGiveUp}>
            <Text style={styles.giveUpButtonText}>Give Up</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  statText: { fontSize: 13, fontWeight: '600', color: '#3730a3' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  durationChipActive: { backgroundColor: '#4f46e5' },
  durationChipText: { fontWeight: '600', color: '#374151' },
  durationChipTextActive: { color: '#fff' },
  startButton: {
    marginTop: 16,
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  muted: { color: '#6b7280', marginVertical: 4 },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sessionDate: { fontSize: 13, color: '#374151', flexShrink: 1 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeFail: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  runningWrap: { alignItems: 'center', marginTop: 24, gap: 16 },
  countdown: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack: {
    width: '100%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 7,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4f46e5' },
  readyText: { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  completeButton: {
    width: '100%',
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  disabledButton: { backgroundColor: '#9ca3af' },
  giveUpButton: {
    width: '100%',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  giveUpButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toast: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  toastText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
