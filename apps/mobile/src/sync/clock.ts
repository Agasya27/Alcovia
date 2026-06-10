import { getAllOperations } from '../db/clientDb';

// In-memory Lamport clock. Initialised from the highest lamportClock seen in
// local operations at startup, then advanced on every local event and bumped
// past any remote value observed during sync.
let clock = 0;

export function getLamportClock(): number {
  return clock;
}

export function tickClock(): number {
  clock += 1;
  return clock;
}

export function updateClock(remote: number): void {
  clock = Math.max(clock, remote) + 1;
}

// Seed the clock from durable storage so logical time survives a reload.
export async function initClock(): Promise<void> {
  const ops = await getAllOperations();
  const highest = ops.reduce((max, op) => Math.max(max, op.lamportClock), 0);
  clock = highest;
}
