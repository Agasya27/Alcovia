import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Operation, StudentState } from '../types';
import { DEVICE_ID, STUDENT_ID } from '../config';
import { buildSeedState } from './seed';

// Storage is namespaced per device so two clients (two browser tabs, or a phone
// and a laptop) behave like two independent devices that converge via the server.
const NS = `alcovia-${DEVICE_ID}`;
const stateKey = (studentId: string) => `${NS}:state:${studentId}`;
const OPS_KEY = `${NS}:operations`;

async function readOps(): Promise<Operation[]> {
  const raw = await AsyncStorage.getItem(OPS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Operation[];
  } catch {
    return [];
  }
}

async function writeOps(ops: Operation[]): Promise<void> {
  await AsyncStorage.setItem(OPS_KEY, JSON.stringify(ops));
}

export async function seedInitialState(): Promise<StudentState> {
  const seed = buildSeedState();
  await AsyncStorage.setItem(stateKey(seed.studentId), JSON.stringify(seed));
  return seed;
}

export async function getState(studentId: string = STUDENT_ID): Promise<StudentState> {
  const raw = await AsyncStorage.getItem(stateKey(studentId));
  if (raw) {
    try {
      return JSON.parse(raw) as StudentState;
    } catch {
      // fall through to reseed on corrupt data
    }
  }
  return seedInitialState();
}

export async function saveState(state: StudentState): Promise<void> {
  await AsyncStorage.setItem(stateKey(state.studentId), JSON.stringify(state));
}

export async function addOperation(op: Operation): Promise<void> {
  const ops = await readOps();
  const idx = ops.findIndex((o) => o.id === op.id);
  if (idx >= 0) {
    ops[idx] = op;
  } else {
    ops.push(op);
  }
  await writeOps(ops);
}

export async function getPendingOperations(): Promise<Operation[]> {
  const ops = await readOps();
  return ops
    .filter((op) => !op.synced)
    .sort((a, b) => a.lamportClock - b.lamportClock);
}

export async function getAllOperations(): Promise<Operation[]> {
  const ops = await readOps();
  return [...ops].sort((a, b) => a.lamportClock - b.lamportClock);
}

export async function markOperationsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const ops = await readOps();
  for (const op of ops) {
    if (idSet.has(op.id)) op.synced = true;
  }
  await writeOps(ops);
}
