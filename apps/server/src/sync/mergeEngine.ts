import type { FocusSession, StudentState, Task, TaskStatus } from '../types';
import {
  getStudentState,
  getUnprocessedOperations,
  hasRewardBeenGranted,
  markOperationProcessed,
  recordReward,
  upsertStudentState,
} from '../db/serverDb';
import { buildSeedState } from '../db/seed';
import { fireN8nWebhook } from './n8nWebhook';

const COINS_PER_SESSION = 50;

function findTask(state: StudentState, subjectId: string, chapterId: string, taskId: string): Task | undefined {
  const subject = state.subjects.find((s) => s.id === subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  return chapter?.tasks.find((t) => t.id === taskId);
}

// Processes all unprocessed operations in Lamport-clock order, rebuilding the
// canonical student state. Idempotency on rewards is enforced via reward_log.
export async function processOperations(studentId: string): Promise<void> {
  const ops = getUnprocessedOperations(studentId);
  const state = getStudentState(studentId) ?? buildSeedState();

  for (const op of ops) {
    switch (op.type) {
      case 'SESSION_COMPLETED': {
        const session = op.payload.session as FocusSession;

        if (!hasRewardBeenGranted(session.id)) {
          state.coins += COINS_PER_SESSION;
          state.todayFocusMinutes += Math.floor(session.actualDuration / 60);

          const today = new Date().toISOString().slice(0, 10);
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          if (state.lastStreakDate === yesterday || state.lastStreakDate === '') {
            state.streak += 1;
            state.lastStreakDate = today;
          } else if (state.lastStreakDate !== today) {
            state.streak = 1; // streak broken, reset to 1
            state.lastStreakDate = today;
          }
          // if lastStreakDate === today: already counted today, do not double.

          const existing = state.sessions.find((s) => s.id === session.id);
          if (existing) {
            existing.rewardGranted = true;
          } else {
            state.sessions.push({ ...session, rewardGranted: true });
          }

          recordReward(session.id, studentId);

          // Fire and forget; n8n + notification_log guarantee exactly-once.
          fireN8nWebhook(session.id, studentId, state.streak, COINS_PER_SESSION).catch(
            (err) => console.error('n8n webhook failed:', err?.message ?? err),
          );
        }
        break;
      }

      case 'SESSION_FAILED': {
        const session = op.payload.session as FocusSession;
        if (!state.sessions.find((s) => s.id === session.id)) {
          state.sessions.push(session);
        }
        break;
      }

      case 'TASK_STATUS_CHANGED': {
        const subjectId = op.payload.subjectId as string;
        const chapterId = op.payload.chapterId as string;
        const taskId = op.payload.taskId as string;
        const newStatus = op.payload.newStatus as TaskStatus;
        const opClock = op.payload.lamportClock as number;

        const task = findTask(state, subjectId, chapterId, taskId);
        if (task && task.deletedAt === undefined) {
          const current = task.lamportClock ?? 0;
          if (opClock > current) {
            task.status = newStatus;
            task.lamportClock = opClock;
          }
        }
        break;
      }

      case 'TASK_DELETED': {
        const subjectId = op.payload.subjectId as string;
        const chapterId = op.payload.chapterId as string;
        const taskId = op.payload.taskId as string;
        const opClock = op.payload.lamportClock as number;
        const deletedAt = (op.payload.deletedAt as number) ?? op.createdAt;

        const task = findTask(state, subjectId, chapterId, taskId);
        if (task) {
          // Tombstone wins over any concurrent status change.
          task.deletedAt = deletedAt;
          task.lamportClock = Math.max(task.lamportClock ?? 0, opClock);
        }
        break;
      }
    }

    markOperationProcessed(op.id);
  }

  upsertStudentState(state);
}
