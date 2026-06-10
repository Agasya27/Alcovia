import type {
  Chapter,
  ChapterProgress,
  Subject,
  SubjectProgress,
} from '../types';

function isActive(task: { deletedAt?: number }): boolean {
  return task.deletedAt === undefined;
}

export function computeChapterProgress(chapter: Chapter): ChapterProgress {
  const active = chapter.tasks.filter(isActive);
  const totalTasks = active.length;
  const completedTasks = active.filter((t) => t.status === 'done').length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  return { chapterId: chapter.id, completedTasks, totalTasks, percent };
}

export function computeSubjectProgress(subject: Subject): SubjectProgress {
  const chapters = subject.chapters.map(computeChapterProgress);
  const percent =
    chapters.length === 0
      ? 0
      : Math.round(chapters.reduce((sum, c) => sum + c.percent, 0) / chapters.length);
  return { subjectId: subject.id, percent, chapters };
}

export function computeAllProgress(subjects: Subject[]): SubjectProgress[] {
  return subjects.map(computeSubjectProgress);
}
