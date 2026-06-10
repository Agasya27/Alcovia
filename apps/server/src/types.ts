// ─── Core domain ───────────────────────────────────────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'done';

export interface Task {
  id: string;
  chapterId: string;
  title: string;
  status: TaskStatus;
  deletedAt?: number; // tombstone; undefined = not deleted
  lamportClock?: number; // logical clock of the last write that touched this task
}

export interface Chapter {
  id: string;
  subjectId: string;
  title: string;
  tasks: Task[];
}

export interface Subject {
  id: string;
  title: string;
  chapters: Chapter[];
}

export type FailReason = 'give_up' | 'app_switch';

export interface FocusSession {
  id: string; // stable UUID, generated on device at session start
  studentId: string;
  startedAt: number; // Unix ms (device clock, used for display only)
  targetDuration: number; // seconds
  actualDuration: number; // seconds elapsed when ended
  status: 'completed' | 'failed';
  failReason?: FailReason;
  rewardGranted: boolean; // set true by server exactly once
  notificationSent: boolean; // set true by n8n ack
  lamportClock: number; // logical clock value at time of completion
}

export interface StudentState {
  studentId: string;
  coins: number;
  streak: number; // days
  todayFocusMinutes: number;
  lastStreakDate: string; // 'YYYY-MM-DD'
  subjects: Subject[];
  sessions: FocusSession[];
}

// ─── Sync protocol ─────────────────────────────────────────────

export type OperationType =
  | 'SESSION_COMPLETED'
  | 'SESSION_FAILED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED';

export interface Operation {
  id: string; // UUID, stable — used for idempotency
  studentId: string;
  deviceId: string;
  type: OperationType;
  payload: Record<string, unknown>;
  lamportClock: number; // logical clock at time of operation
  createdAt: number; // device Unix ms, for display only
  synced: boolean; // client-side: has this been ACKed by server?
}

// ─── Derived / computed ────────────────────────────────────────

export interface ChapterProgress {
  chapterId: string;
  completedTasks: number;
  totalTasks: number;
  percent: number;
}

export interface SubjectProgress {
  subjectId: string;
  percent: number;
  chapters: ChapterProgress[];
}
