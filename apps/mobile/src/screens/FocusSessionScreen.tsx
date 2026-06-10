import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../store/sessionStore';
import { useStateStore } from '../store/stateStore';
import type { FocusSession } from '../types';
import { card, colors, radius, space, type } from '../theme';

const DURATION_OPTIONS: { label: string; seconds: number }[] = [
  { label: '10s', seconds: 10 },
  { label: '25m', seconds: 25 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '45m', seconds: 45 * 60 },
  { label: '60m', seconds: 60 * 60 },
  { label: '90m', seconds: 90 * 60 },
  { label: '120m', seconds: 120 * 60 },
];

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const s = (safe % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(totalSeconds: number): string {
  return totalSeconds < 60 ? `${totalSeconds}s` : `${Math.round(totalSeconds / 60)}m`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function FocusSessionScreen() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const startSession = useSessionStore((s) => s.startSession);
  const completeSession = useSessionStore((s) => s.completeSession);
  const failSession = useSessionStore((s) => s.failSession);

  const student = useStateStore((s) => s.student);
  const [selectedSeconds, setSelectedSeconds] = useState(10);
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
    showToast(`+50 coins · streak ${s?.streak ?? 0}`);
  }

  function onGiveUp() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Give up this session? No reward will be granted.')
    ) {
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
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <Stat label="Streak" value={`${student?.streak ?? 0}d`} />
        <Stat label="Coins" value={student?.coins ?? 0} />
        <Stat label="Today" value={`${student?.todayFocusMinutes ?? 0}m`} />
      </View>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {!activeSession ? (
        <View style={{ gap: space.lg }}>
          <View style={[card, styles.panel]}>
            <Text style={styles.eyebrow}>New session</Text>
            <Text style={styles.panelTitle}>How long will you focus?</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = selectedSeconds === opt.seconds;
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedSeconds(opt.seconds)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => startSession(selectedSeconds)}>
              <Text style={styles.primaryBtnText}>Start session</Text>
            </Pressable>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Recent sessions</Text>
            {recentSessions.length === 0 ? (
              <View style={[card, styles.emptyCard]}>
                <Text style={styles.emptyText}>No sessions yet.</Text>
                <Text style={styles.emptySub}>Pick a duration above and start your first one.</Text>
              </View>
            ) : (
              <View style={[card, styles.listCard]}>
                {recentSessions.map((s, i) => (
                  <View
                    key={s.id}
                    style={[styles.sessionRow, i > 0 && styles.rowDivider]}
                  >
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.sessionPrimary}>
                        {formatDuration(s.targetDuration)} session
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {new Date(s.startedAt).toLocaleString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusTag,
                        s.status === 'completed' ? styles.tagOk : styles.tagFail,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          s.status === 'completed' ? styles.tagOkText : styles.tagFailText,
                        ]}
                      >
                        {s.status === 'completed' ? 'Completed' : `Failed · ${s.failReason ?? ''}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={[card, styles.timerCard]}>
          <Text style={styles.eyebrow}>{canComplete ? 'Target reached' : 'Focusing'}</Text>
          <Text style={styles.timer}>{formatMMSS(remaining)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={canComplete ? styles.readyText : styles.hintText}>
            {canComplete
              ? 'You can complete now.'
              : 'Stay on this tab — leaving for 5s ends the session.'}
          </Text>

          <Pressable
            style={[styles.primaryBtn, !canComplete && styles.primaryBtnDisabled]}
            disabled={!canComplete}
            onPress={onComplete}
          >
            <Text style={styles.primaryBtnText}>Complete</Text>
          </Pressable>

          <Pressable style={styles.ghostDangerBtn} onPress={onGiveUp}>
            <Text style={styles.ghostDangerText}>Give up</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg },

  statsRow: { flexDirection: 'row', gap: space.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.small, color: colors.muted, marginTop: 2 },

  panel: { padding: space.lg, gap: space.md },
  eyebrow: { ...type.label, color: colors.accent, textTransform: 'uppercase' },
  panelTitle: { ...type.h2, color: colors.ink },
  sectionTitle: { ...type.h2, color: colors.ink, marginBottom: space.sm },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { ...type.body, color: colors.inkSoft, fontWeight: '600' },
  chipTextActive: { color: colors.surface },

  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: colors.borderStrong },
  primaryBtnText: { color: colors.surface, fontSize: 16, fontWeight: '700' },

  ghostDangerBtn: {
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  ghostDangerText: { color: colors.danger, fontSize: 15, fontWeight: '700' },

  emptyCard: { padding: space.xl, alignItems: 'center', gap: 4 },
  emptyText: { ...type.h2, color: colors.ink },
  emptySub: { ...type.small, color: colors.muted },

  listCard: { paddingHorizontal: space.lg },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  sessionPrimary: { ...type.body, color: colors.ink, fontWeight: '600' },
  sessionMeta: { ...type.small, color: colors.muted, marginTop: 2 },
  statusTag: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill },
  tagOk: { backgroundColor: colors.accentSoft },
  tagFail: { backgroundColor: colors.dangerSoft },
  statusTagText: { ...type.label },
  tagOkText: { color: colors.accent },
  tagFailText: { color: colors.danger },

  timerCard: { padding: space.xl, alignItems: 'center', gap: space.lg },
  timer: {
    ...type.display,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  readyText: { ...type.body, color: colors.accent, fontWeight: '700' },
  hintText: { ...type.small, color: colors.muted, textAlign: 'center' },

  toast: {
    backgroundColor: colors.ink,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  toastText: { color: colors.surface, textAlign: 'center', fontWeight: '700', fontSize: 14 },
});
