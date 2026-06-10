import { create } from 'zustand';
import { AppState, type NativeEventSubscription } from 'react-native';
import type { FailReason, FocusSession } from '../types';
import { createSessionCompletedOp, createSessionFailedOp } from '../sync/operations';
import { getLamportClock } from '../sync/clock';
import { useStateStore } from './stateStore';
import { COINS_PER_SESSION, STUDENT_ID } from '../config';

interface ActiveSession {
  id: string;
  targetDuration: number; // seconds
  elapsedSeconds: number;
  startedAt: number;
  status: 'running' | 'idle';
}

interface SessionStore {
  activeSession: ActiveSession | null;
  startSession: (targetDuration: number) => void;
  completeSession: () => Promise<void>;
  failSession: (reason: FailReason) => Promise<void>;
}

let tickTimer: ReturnType<typeof setInterval> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function clearTimers(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null,

  startSession(targetDuration) {
    clearTimers();
    const active: ActiveSession = {
      id: crypto.randomUUID(),
      targetDuration,
      elapsedSeconds: 0,
      startedAt: Date.now(),
      status: 'running',
    };
    set({ activeSession: active });

    tickTimer = setInterval(() => {
      const current = get().activeSession;
      if (!current || current.status !== 'running') return;
      set({ activeSession: { ...current, elapsedSeconds: current.elapsedSeconds + 1 } });
    }, 1000);

    // Leaving the session (backgrounding the app) for more than the grace
    // period counts as an abandoned ("app_switch") attempt.
    appStateSub = AppState.addEventListener('change', (next) => {
      const current = get().activeSession;
      if (!current || current.status !== 'running') return;
      if (next === 'active') {
        if (graceTimer) {
          clearTimeout(graceTimer);
          graceTimer = null;
        }
      } else {
        if (graceTimer) clearTimeout(graceTimer);
        graceTimer = setTimeout(() => {
          void get().failSession('app_switch');
        }, 5000);
      }
    });
  },

  async completeSession() {
    const active = get().activeSession;
    if (!active) return;
    if (active.elapsedSeconds < active.targetDuration) return; // not allowed yet
    clearTimers();

    const session: FocusSession = {
      id: active.id,
      studentId: STUDENT_ID,
      startedAt: active.startedAt,
      targetDuration: active.targetDuration,
      actualDuration: active.elapsedSeconds,
      status: 'completed',
      rewardGranted: false,
      notificationSent: false,
      lamportClock: getLamportClock(),
    };

    const op = await createSessionCompletedOp(session);
    session.lamportClock = op.lamportClock;

    const minutes = Math.floor(session.actualDuration / 60);
    const today = todayStr();

    // Optimistic local reward. The server is authoritative and will correct
    // these values on the next pull (it prevents double-awarding).
    await useStateStore.getState().update((draft) => {
      draft.coins += COINS_PER_SESSION;
      draft.todayFocusMinutes += minutes;
      if (draft.lastStreakDate !== today) {
        draft.streak += 1;
        draft.lastStreakDate = today;
      }
      draft.sessions = [...draft.sessions, session];
      return draft;
    });

    set({ activeSession: null });
  },

  async failSession(reason) {
    const active = get().activeSession;
    if (!active) return;
    clearTimers();

    const session: FocusSession = {
      id: active.id,
      studentId: STUDENT_ID,
      startedAt: active.startedAt,
      targetDuration: active.targetDuration,
      actualDuration: active.elapsedSeconds,
      status: 'failed',
      failReason: reason,
      rewardGranted: false,
      notificationSent: false,
      lamportClock: getLamportClock(),
    };

    const op = await createSessionFailedOp(session);
    session.lamportClock = op.lamportClock;

    await useStateStore.getState().update((draft) => {
      draft.sessions = [...draft.sessions, session];
      return draft;
    });

    set({ activeSession: null });
  },
}));
