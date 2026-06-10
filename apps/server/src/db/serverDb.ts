import path from 'node:path';
import Database from 'better-sqlite3';
import type { Operation, StudentState } from '../types';
import { buildSeedState, STUDENT_ID } from './seed';

const DB_PATH = path.join(process.cwd(), 'alcovia.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── Migrations ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    lamportClock INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    processedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS student_state (
    studentId TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    todayFocusMinutes INTEGER NOT NULL DEFAULT 0,
    lastStreakDate TEXT NOT NULL DEFAULT '',
    subjects TEXT NOT NULL DEFAULT '[]',
    sessions TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS reward_log (
    sessionId TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    grantedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    sessionId TEXT PRIMARY KEY,
    firedAt INTEGER NOT NULL
  );
`);

// ─── Operations ────────────────────────────────────────────────
export function insertOperation(op: Operation): void {
  db.prepare(
    `INSERT OR IGNORE INTO operations (id, studentId, deviceId, type, payload, lamportClock, createdAt, processedAt)
     VALUES (@id, @studentId, @deviceId, @type, @payload, @lamportClock, @createdAt, NULL)`,
  ).run({
    id: op.id,
    studentId: op.studentId,
    deviceId: op.deviceId,
    type: op.type,
    payload: JSON.stringify(op.payload),
    lamportClock: op.lamportClock,
    createdAt: op.createdAt,
  });
}

export function operationExists(id: string): boolean {
  const row = db.prepare(`SELECT 1 FROM operations WHERE id = ?`).get(id);
  return row !== undefined;
}

interface OperationRow {
  id: string;
  studentId: string;
  deviceId: string;
  type: string;
  payload: string;
  lamportClock: number;
  createdAt: number;
  processedAt: number | null;
}

export function getUnprocessedOperations(studentId: string): Operation[] {
  const rows = db
    .prepare(
      `SELECT * FROM operations
       WHERE studentId = ? AND processedAt IS NULL
       ORDER BY lamportClock ASC, id ASC`,
    )
    .all(studentId) as OperationRow[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    deviceId: r.deviceId,
    type: r.type as Operation['type'],
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    lamportClock: r.lamportClock,
    createdAt: r.createdAt,
    synced: true,
  }));
}

export function markOperationProcessed(id: string): void {
  db.prepare(`UPDATE operations SET processedAt = ? WHERE id = ?`).run(Date.now(), id);
}

// ─── Student state ─────────────────────────────────────────────
interface StateRow {
  studentId: string;
  coins: number;
  streak: number;
  todayFocusMinutes: number;
  lastStreakDate: string;
  subjects: string;
  sessions: string;
}

export function getStudentState(studentId: string): StudentState | undefined {
  const row = db.prepare(`SELECT * FROM student_state WHERE studentId = ?`).get(studentId) as
    | StateRow
    | undefined;
  if (!row) return undefined;
  return {
    studentId: row.studentId,
    coins: row.coins,
    streak: row.streak,
    todayFocusMinutes: row.todayFocusMinutes,
    lastStreakDate: row.lastStreakDate,
    subjects: JSON.parse(row.subjects) as StudentState['subjects'],
    sessions: JSON.parse(row.sessions) as StudentState['sessions'],
  };
}

export function upsertStudentState(state: StudentState): void {
  db.prepare(
    `INSERT INTO student_state (studentId, coins, streak, todayFocusMinutes, lastStreakDate, subjects, sessions)
     VALUES (@studentId, @coins, @streak, @todayFocusMinutes, @lastStreakDate, @subjects, @sessions)
     ON CONFLICT(studentId) DO UPDATE SET
       coins = excluded.coins,
       streak = excluded.streak,
       todayFocusMinutes = excluded.todayFocusMinutes,
       lastStreakDate = excluded.lastStreakDate,
       subjects = excluded.subjects,
       sessions = excluded.sessions`,
  ).run({
    studentId: state.studentId,
    coins: state.coins,
    streak: state.streak,
    todayFocusMinutes: state.todayFocusMinutes,
    lastStreakDate: state.lastStreakDate,
    subjects: JSON.stringify(state.subjects),
    sessions: JSON.stringify(state.sessions),
  });
}

// ─── Reward idempotency ────────────────────────────────────────
export function hasRewardBeenGranted(sessionId: string): boolean {
  const row = db.prepare(`SELECT 1 FROM reward_log WHERE sessionId = ?`).get(sessionId);
  return row !== undefined;
}

export function recordReward(sessionId: string, studentId: string): void {
  db.prepare(
    `INSERT OR IGNORE INTO reward_log (sessionId, studentId, grantedAt) VALUES (?, ?, ?)`,
  ).run(sessionId, studentId, Date.now());
}

// ─── Notification idempotency ──────────────────────────────────
export function hasNotificationBeenSent(sessionId: string): boolean {
  const row = db.prepare(`SELECT 1 FROM notification_log WHERE sessionId = ?`).get(sessionId);
  return row !== undefined;
}

export function recordNotification(sessionId: string): void {
  db.prepare(`INSERT OR IGNORE INTO notification_log (sessionId, firedAt) VALUES (?, ?)`).run(
    sessionId,
    Date.now(),
  );
}

interface NotificationRow {
  sessionId: string;
  firedAt: number;
}

export function getNotificationLog(): NotificationRow[] {
  return db
    .prepare(`SELECT sessionId, firedAt FROM notification_log ORDER BY firedAt ASC`)
    .all() as NotificationRow[];
}

// ─── Seed default account ──────────────────────────────────────
export function ensureSeed(): void {
  if (!getStudentState(STUDENT_ID)) {
    upsertStudentState(buildSeedState());
  }
}

ensureSeed();
