import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Operation, StudentState } from '../types';
import { DEVICE_ID, STUDENT_ID } from '../config';
import { buildSeedState } from './seed';

interface AlcoviaDB extends DBSchema {
  state: {
    key: string;
    value: StudentState;
  };
  operations: {
    key: string;
    value: Operation;
    indexes: { synced: string; lamportClock: number };
  };
}

// DB name is namespaced per device so two browser tabs do not share storage.
const DB_NAME = `alcovia-${DEVICE_ID}`;
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AlcoviaDB>> | null = null;

function getDb(): Promise<IDBPDatabase<AlcoviaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AlcoviaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'studentId' });
        }
        if (!db.objectStoreNames.contains('operations')) {
          const opStore = db.createObjectStore('operations', { keyPath: 'id' });
          // idb cannot index booleans reliably across browsers, so we store the
          // synced flag as a string ('true' | 'false') in a dedicated index field.
          opStore.createIndex('synced', 'syncedFlag' as never);
          opStore.createIndex('lamportClock', 'lamportClock');
        }
      },
    });
  }
  return dbPromise;
}

// Operations are persisted with an extra string flag so the `synced` index works.
type StoredOperation = Operation & { syncedFlag: 'true' | 'false' };

function toStored(op: Operation): StoredOperation {
  return { ...op, syncedFlag: op.synced ? 'true' : 'false' };
}

function fromStored(op: StoredOperation): Operation {
  const { syncedFlag, ...rest } = op;
  return rest;
}

export async function seedInitialState(): Promise<StudentState> {
  const seed = buildSeedState();
  const db = await getDb();
  await db.put('state', seed);
  return seed;
}

export async function getState(studentId: string = STUDENT_ID): Promise<StudentState> {
  const db = await getDb();
  const existing = await db.get('state', studentId);
  if (existing) return existing;
  return seedInitialState();
}

export async function saveState(state: StudentState): Promise<void> {
  const db = await getDb();
  await db.put('state', state);
}

export async function addOperation(op: Operation): Promise<void> {
  const db = await getDb();
  await db.put('operations', toStored(op) as unknown as Operation);
}

export async function getPendingOperations(): Promise<Operation[]> {
  const db = await getDb();
  const all = (await db.getAll('operations')) as unknown as StoredOperation[];
  return all
    .filter((op) => op.syncedFlag === 'false')
    .map(fromStored)
    .sort((a, b) => a.lamportClock - b.lamportClock);
}

export async function getAllOperations(): Promise<Operation[]> {
  const db = await getDb();
  const all = (await db.getAll('operations')) as unknown as StoredOperation[];
  return all.map(fromStored).sort((a, b) => a.lamportClock - b.lamportClock);
}

export async function markOperationsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('operations', 'readwrite');
  for (const id of ids) {
    const existing = (await tx.store.get(id)) as unknown as StoredOperation | undefined;
    if (existing) {
      existing.synced = true;
      existing.syncedFlag = 'true';
      await tx.store.put(existing as unknown as Operation);
    }
  }
  await tx.done;
}
