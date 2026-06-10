import { create } from 'zustand';
import type { Subject, TaskStatus } from '../types';
import { createTaskDeletedOp, createTaskStatusChangedOp } from '../sync/operations';
import { useStateStore } from './stateStore';

interface SyllabusStore {
  loadSubjects: () => Promise<void>;
  updateTaskStatus: (
    subjectId: string,
    chapterId: string,
    taskId: string,
    newStatus: TaskStatus,
  ) => Promise<void>;
  deleteTask: (subjectId: string, chapterId: string, taskId: string) => Promise<void>;
}

// Subjects live inside the canonical StudentState; this hook exposes them.
export function useSubjects(): Subject[] {
  return useStateStore((s) => s.student?.subjects ?? []);
}

export const useSyllabusStore = create<SyllabusStore>(() => ({
  async loadSubjects() {
    const store = useStateStore.getState();
    if (!store.loaded) await store.load();
  },

  async updateTaskStatus(subjectId, chapterId, taskId, newStatus) {
    const op = await createTaskStatusChangedOp(taskId, chapterId, subjectId, newStatus);
    const clock = op.lamportClock;
    await useStateStore.getState().update((draft) => {
      const subject = draft.subjects.find((s) => s.id === subjectId);
      const chapter = subject?.chapters.find((c) => c.id === chapterId);
      const task = chapter?.tasks.find((t) => t.id === taskId);
      if (task && task.deletedAt === undefined) {
        task.status = newStatus;
        task.lamportClock = clock;
      }
      return draft;
    });
  },

  async deleteTask(subjectId, chapterId, taskId) {
    const op = await createTaskDeletedOp(taskId, chapterId, subjectId);
    const clock = op.lamportClock;
    const deletedAt = (op.payload.deletedAt as number) ?? Date.now();
    await useStateStore.getState().update((draft) => {
      const subject = draft.subjects.find((s) => s.id === subjectId);
      const chapter = subject?.chapters.find((c) => c.id === chapterId);
      const task = chapter?.tasks.find((t) => t.id === taskId);
      if (task) {
        task.deletedAt = deletedAt;
        task.lamportClock = clock;
      }
      return draft;
    });
  },
}));
