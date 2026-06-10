import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLastSyncedAt, getOnline, setOnline, syncNow } from '../sync/syncEngine';
import { getPendingOperations, getState } from '../db/clientDb';
import { useSessionStore } from '../store/sessionStore';
import { useStateStore } from '../store/stateStore';
import type { Operation, StudentState } from '../types';
import { API_URL, DEVICE_ID, STUDENT_ID } from '../config';
import { card, colors, mono, radius, space, type } from '../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[card, styles.section]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Btn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.btn, disabled && styles.btnDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export default function DevPanelScreen() {
  const [online, setOnlineState] = useState(getOnline());
  const [lastSynced, setLastSynced] = useState<number | null>(getLastSyncedAt());
  const [snapshot, setSnapshot] = useState<StudentState | null>(null);
  const [outbox, setOutbox] = useState<Operation[]>([]);
  const [n8nLog, setN8nLog] = useState<{ sessionId: string; firedAt: number }[]>([]);
  const [serverState, setServerState] = useState<StudentState | null>(null);

  const student = useStateStore((s) => s.student);
  const failSession = useSessionStore((s) => s.failSession);
  const activeSession = useSessionStore((s) => s.activeSession);

  useEffect(() => {
    const id = setInterval(() => {
      setOnlineState(getOnline());
      setLastSynced(getLastSyncedAt());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function toggleOnline() {
    const next = !getOnline();
    setOnline(next);
    setOnlineState(next);
  }

  async function refreshState() {
    setSnapshot(await getState(STUDENT_ID));
  }
  async function refreshOutbox() {
    setOutbox(await getPendingOperations());
  }
  async function checkServerLog() {
    try {
      const res = await fetch(`${API_URL}/sync/n8n-log`);
      const json = (await res.json()) as {
        notifications: { sessionId: string; firedAt: number }[];
      };
      setN8nLog(json.notifications ?? []);
    } catch {
      setN8nLog([]);
    }
  }
  async function loadServerState() {
    try {
      const res = await fetch(`${API_URL}/sync/state?studentId=${encodeURIComponent(STUDENT_ID)}`);
      setServerState((await res.json()) as StudentState);
    } catch {
      setServerState(null);
    }
  }

  const lastSyncedLabel = lastSynced
    ? `${Math.round((Date.now() - lastSynced) / 1000)}s ago`
    : 'Never';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Dev Panel</Text>

      <Section title="Network">
        <Text style={styles.kv}>
          Device <Text style={styles.kvStrong}>{DEVICE_ID}</Text>
        </Text>
        <Pressable
          style={[styles.toggle, online ? styles.toggleOnline : styles.toggleOffline]}
          onPress={toggleOnline}
        >
          <View style={[styles.toggleDot, { backgroundColor: online ? colors.online : colors.offline }]} />
          <Text style={[styles.toggleText, { color: online ? colors.online : colors.offline }]}>
            {online ? 'Online — tap to go offline' : 'Offline — tap to go online'}
          </Text>
        </Pressable>
      </Section>

      <Section title="Manual sync">
        <Btn label="Sync now" onPress={() => void syncNow()} />
        <Text style={styles.kv}>Last synced: {lastSyncedLabel}</Text>
      </Section>

      <Section title="Current state (this device)">
        <Btn label="Refresh state" onPress={refreshState} />
        <Text style={styles.json}>{JSON.stringify(snapshot ?? student, null, 2)}</Text>
      </Section>

      <Section title="Pending operations (outbox)">
        <Btn label="Refresh outbox" onPress={refreshOutbox} />
        {outbox.length === 0 ? (
          <Text style={styles.kv}>No pending operations.</Text>
        ) : (
          outbox.map((op) => (
            <View key={op.id} style={styles.opRow}>
              <Text style={styles.opType}>{op.type}</Text>
              <Text style={styles.opMeta}>clock {op.lamportClock}</Text>
            </View>
          ))
        )}
      </Section>

      <Section title="n8n notifications (server-side)">
        <Btn label="Check server" onPress={checkServerLog} />
        {n8nLog.length === 0 ? (
          <Text style={styles.kv}>No notifications fired yet.</Text>
        ) : (
          n8nLog.map((n) => (
            <View key={n.sessionId} style={styles.opRow}>
              <Text style={styles.opType} numberOfLines={1}>
                {n.sessionId}
              </Text>
              <Text style={styles.opMeta}>{new Date(n.firedAt).toLocaleTimeString()}</Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Conflict scenarios">
        <Btn
          label="Simulate app switch"
          disabled={!activeSession}
          onPress={() => void failSession('app_switch')}
        />
        <Btn label="Force push outbox" onPress={() => void syncNow()} />
      </Section>

      <Section title="Server canonical state">
        <Btn label="Load server state" onPress={loadServerState} />
        <Text style={styles.json}>{JSON.stringify(serverState, null, 2)}</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  heading: { ...type.h1, color: colors.ink, marginBottom: space.xs },
  section: { padding: space.lg, gap: space.sm },
  sectionTitle: { ...type.label, color: colors.muted, textTransform: 'uppercase' },

  kv: { ...type.small, color: colors.inkSoft },
  kvStrong: { color: colors.ink, fontWeight: '700' },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toggleOnline: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  toggleOffline: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  toggleDot: { width: 9, height: 9, borderRadius: 5 },
  toggleText: { ...type.body, fontWeight: '700' },

  btn: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 11,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { ...type.body, color: colors.ink, fontWeight: '700' },

  json: {
    fontFamily: mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkSoft,
    backgroundColor: colors.surfaceMuted,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  opRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  opType: { fontFamily: mono, fontSize: 12, color: colors.ink, flexShrink: 1 },
  opMeta: { fontFamily: mono, fontSize: 11, color: colors.muted },
});
