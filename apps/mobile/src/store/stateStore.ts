import { create } from 'zustand';
import type { StudentState } from '../types';
import { getState, saveState } from '../db/clientDb';
import { STUDENT_ID } from '../config';

interface StateStore {
  student: StudentState | null;
  loaded: boolean;
  load: () => Promise<void>;
  // Replace the whole student state and persist it. Used by reconcile.
  replace: (next: StudentState) => Promise<void>;
  // Apply a mutation to the current student state and persist it.
  update: (mutator: (draft: StudentState) => StudentState) => Promise<void>;
}

export const useStateStore = create<StateStore>((set, get) => ({
  student: null,
  loaded: false,

  async load() {
    const student = await getState(STUDENT_ID);
    set({ student, loaded: true });
  },

  async replace(next) {
    await saveState(next);
    set({ student: next });
  },

  async update(mutator) {
    const current = get().student ?? (await getState(STUDENT_ID));
    const next = mutator(structuredClone(current));
    await saveState(next);
    set({ student: next });
  },
}));

export function getStudentSnapshot(): StudentState | null {
  return useStateStore.getState().student;
}
