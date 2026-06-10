import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getLastSyncedAt,
  getOnline,
  setOnline,
  syncNow,
} from '../sync/syncEngine';
import { getPendingOperations, getState } from '../db/clientDb';
import { useSessionStore } from '../store/sessionStore';
import { useStateStore } from '../store/stateStore';
import type { Operation, StudentState } from '../types';
import { API_URL, DEVICE_ID, STUDENT_ID } from '../config';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
      const json = (await res.json()) as { notifications: { sessionId: string; firedAt: number }[] };
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
    <ScrollView contentContainerStyle={styles.container}>
      <Section title="Network Control">
        <Text style={styles.mono}>Device ID: {DEVICE_ID}</Text>
        <Pressable
          style={[styles.toggle, online ? styles.online : styles.offline]}
          onPress={toggleOnline}
        >
          <Text style={styles.toggleText}>{online ? 'ONLINE ✅' : 'OFFLINE ❌'}</Text>
        </Pressable>
      </Section>

      <Section title="Manual Sync">
        <Pressable style={styles.button} onPress={() => void syncNow()}>
          <Text style={styles.buttonText}>Sync Now</Text>
        </Pressable>
        <Text style={styles.mono}>Last synced: {lastSyncedLabel}</Text>
      </Section>

      <Section title="Current State Snapshot">
        <Pressable style={styles.button} onPress={refreshState}>
          <Text style={styles.buttonText}>Refresh State</Text>
        </Pressable>
        <Text style={styles.json}>{JSON.stringify(snapshot ?? student, null, 2)}</Text>
      </Section>

      <Section title="Pending Operations Outbox">
        <Pressable style={styles.button} onPress={refreshOutbox}>
          <Text style={styles.buttonText}>Refresh Outbox</Text>
        </Pressable>
        {outbox.length === 0 && <Text style={styles.mono}>No pending operations.</Text>}
        {outbox.map((op) => (
          <Text key={op.id} style={styles.mono}>
            {op.type} · clock {op.lamportClock} · synced: false
          </Text>
        ))}
      </Section>

      <Section title="n8n notifications (server-side)">
        <Pressable style={styles.button} onPress={checkServerLog}>
          <Text style={styles.buttonText}>Check Server</Text>
        </Pressable>
        {n8nLog.length === 0 && <Text style={styles.mono}>No notifications fired yet.</Text>}
        {n8nLog.map((n) => (
          <Text key={n.sessionId} style={styles.mono}>
            {n.sessionId} · {new Date(n.firedAt).toLocaleTimeString()}
          </Text>
        ))}
      </Section>

      <Section title="Conflict Scenarios">
        <Pressable
          style={[styles.button, !activeSession && styles.buttonDisabled]}
          disabled={!activeSession}
          onPress={() => void failSession('app_switch')}
        >
          <Text style={styles.buttonText}>Simulate App Switch</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void syncNow()}>
          <Text style={styles.buttonText}>Force Push Outbox</Text>
        </Pressable>
      </Section>

      <Section title="Server Canonical State">
        <Pressable style={styles.button} onPress={loadServerState}>
          <Text style={styles.buttonText}>Load Server State</Text>
        </Pressable>
        <Text style={styles.json}>{JSON.stringify(serverState, null, 2)}</Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, backgroundColor: '#f3f4f6' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  mono: { fontFamily: 'monospace', fontSize: 12, color: '#374151' },
  json: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#111827',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 6,
  },
  toggle: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  online: { backgroundColor: '#16a34a' },
  offline: { backgroundColor: '#dc2626' },
  toggleText: { color: '#fff', fontWeight: '700' },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
