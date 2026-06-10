import type { FocusSession, Operation, OperationType, TaskStatus } from '../types';
import { addOperation } from '../db/clientDb';
import { tickClock } from './clock';
import { DEVICE_ID, STUDENT_ID } from '../config';
import { randomUUID } from '../utils/id';

async function buildOperation(
  type: OperationType,
  payload: Record<string, unknown>,
): Promise<Operation> {
  const lamportClock = tickClock();
  const op: Operation = {
    id: randomUUID(),
    studentId: STUDENT_ID,
    deviceId: DEVICE_ID,
    type,
    payload: { ...payload, lamportClock },
    lamportClock,
    createdAt: Date.now(),
    synced: false,
  };
  await addOperation(op);
  return op;
}

export async function createSessionCompletedOp(session: FocusSession): Promise<Operation> {
  return buildOperation('SESSION_COMPLETED', { session });
}

export async function createSessionFailedOp(session: FocusSession): Promise<Operation> {
  return buildOperation('SESSION_FAILED', { session });
}

export async function createTaskStatusChangedOp(
  taskId: string,
  chapterId: string,
  subjectId: string,
  newStatus: TaskStatus,
  deletedAt?: number,
): Promise<Operation> {
  return buildOperation('TASK_STATUS_CHANGED', {
    taskId,
    chapterId,
    subjectId,
    newStatus,
    deletedAt,
  });
}

export async function createTaskDeletedOp(
  taskId: string,
  chapterId: string,
  subjectId: string,
): Promise<Operation> {
  return buildOperation('TASK_DELETED', {
    taskId,
    chapterId,
    subjectId,
    deletedAt: Date.now(),
  });
}
