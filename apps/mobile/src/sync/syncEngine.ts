import type { FocusSession, StudentState, Task } from '../types';
import {
  getPendingOperations,
  markOperationsSynced,
  getState,
} from '../db/clientDb';
import { updateClock } from './clock';
import { useStateStore, getStudentSnapshot } from '../store/stateStore';
import { API_URL, DEVICE_ID, STUDENT_ID } from '../config';

// ─── Network state ─────────────────────────────────────────────
let isOnline = true;
let lastSyncedAt: number | null = null;
let syncing = false;

export function setOnline(v: boolean): void {
  isOnline = v;
}

export function getOnline(): boolean {
  return isOnline;
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

// ─── Fetch helper with timeout ─────────────────────────────────
async function fetchWithTimeout(url: string, init?: RequestInit, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Sync loop ─────────────────────────────────────────────────
let loopTimer: ReturnType<typeof setInterval> | null = null;

export function startSyncLoop(): void {
  if (loopTimer) return;
  loopTimer = setInterval(() => {
    if (!isOnline) return;
    void syncNow();
  }, 5000);
}

export async function syncNow(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    // Step 1: PUSH unsynced operations.
    const pending = await getPendingOperations();
    if (pending.length > 0) {
      const res = await fetchWithTimeout(`${API_URL}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: STUDENT_ID, deviceId: DEVICE_ID, operations: pending }),
      });
      if (res.ok) {
        await markOperationsSynced(pending.map((op) => op.id));
      }
    }

    // Step 2: PULL canonical state and reconcile.
    const stateRes = await fetchWithTimeout(
      `${API_URL}/sync/state?studentId=${encodeURIComponent(STUDENT_ID)}`,
    );
    if (stateRes.ok) {
      const serverState = (await stateRes.json()) as StudentState;
      await reconcileState(serverState);
      lastSyncedAt = Date.now();
    }
  } catch {
    // Server unreachable or timed out — silently skip and retry next interval.
  } finally {
    syncing = false;
  }
}

// ─── Reconcile ─────────────────────────────────────────────────
function mergeTask(local: Task | undefined, server: Task): Task {
  if (!local) return server;
  const localClock = local.lamportClock ?? 0;
  const serverClock = server.lamportClock ?? 0;
  const clock = Math.max(localClock, serverClock);

  // Tombstone always wins: a deletion is permanent and beats any edit.
  if (local.deletedAt !== undefined || server.deletedAt !== undefined) {
    return {
      ...server,
      status: server.status,
      deletedAt: local.deletedAt ?? server.deletedAt,
      lamportClock: clock,
    };
  }

  // Otherwise highest Lamport clock wins; server breaks an exact tie
  // (deterministic, since both devices reconcile against the same server).
  const winner = serverClock >= localClock ? server : local;
  return { ...winner, lamportClock: clock };
}

function maxLamportInState(state: StudentState): number {
  let max = 0;
  for (const s of state.sessions) max = Math.max(max, s.lamportClock ?? 0);
  for (const subj of state.subjects)
    for (const ch of subj.chapters)
      for (const t of ch.tasks) max = Math.max(max, t.lamportClock ?? 0);
  return max;
}

export async function reconcileState(serverState: StudentState): Promise<void> {
  const local = getStudentSnapshot() ?? (await getState());
  const pending = await getPendingOperations();
  const hasPending = pending.length > 0;

  // 1. Sessions: merge by id. Server is authoritative for rewardGranted and
  //    notificationSent. Local sessions not yet on the server are kept.
  const sessionMap = new Map<string, FocusSession>();
  for (const s of local.sessions) sessionMap.set(s.id, s);
  for (const s of serverState.sessions) {
    const existing = sessionMap.get(s.id);
    sessionMap.set(s.id, existing ? { ...existing, ...s } : s);
  }
  const sessions = [...sessionMap.values()].sort((a, b) => a.startedAt - b.startedAt);

  // 2. Tasks: pick winner by Lamport clock; tombstones win.
  const localTasks = new Map<string, Task>();
  for (const subj of local.subjects)
    for (const ch of subj.chapters)
      for (const t of ch.tasks) localTasks.set(t.id, t);

  const subjects = serverState.subjects.map((subj) => ({
    ...subj,
    chapters: subj.chapters.map((ch) => ({
      ...ch,
      tasks: ch.tasks.map((serverTask) => mergeTask(localTasks.get(serverTask.id), serverTask)),
    })),
  }));

  // 3. Coins / streak / todayFocusMinutes: server authoritative, except keep
  //    optimistic local values while there are unsynced local operations.
  const useServer = !hasPending;
  const merged: StudentState = {
    studentId: STUDENT_ID,
    coins: useServer ? serverState.coins : local.coins,
    streak: useServer ? serverState.streak : local.streak,
    todayFocusMinutes: useServer ? serverState.todayFocusMinutes : local.todayFocusMinutes,
    lastStreakDate: useServer ? serverState.lastStreakDate : local.lastStreakDate,
    subjects,
    sessions,
  };

  updateClock(maxLamportInState(merged));
  await useStateStore.getState().replace(merged);
}
