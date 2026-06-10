import type { StudentState, Subject } from '../types';
import { STUDENT_ID } from '../config';

// Deterministic, stable IDs shared between client and server. Both sides MUST
// seed identical subjects/chapters/tasks so that operations referencing a
// taskId apply consistently everywhere and the two devices converge.
function buildSubjects(): Subject[] {
  const def: { id: string; title: string; chapters: { id: string; title: string }[] }[] = [
    {
      id: 'subject-math',
      title: 'Mathematics',
      chapters: [
        { id: 'subject-math-ch1', title: 'Algebra Basics' },
        { id: 'subject-math-ch2', title: 'Geometry Fundamentals' },
      ],
    },
    {
      id: 'subject-science',
      title: 'Science',
      chapters: [
        { id: 'subject-science-ch1', title: 'Forces and Motion' },
        { id: 'subject-science-ch2', title: 'The Periodic Table' },
      ],
    },
  ];

  return def.map((subject) => ({
    id: subject.id,
    title: subject.title,
    chapters: subject.chapters.map((chapter) => ({
      id: chapter.id,
      subjectId: subject.id,
      title: chapter.title,
      tasks: [1, 2, 3].map((n) => ({
        id: `${chapter.id}-t${n}`,
        chapterId: chapter.id,
        title: `${chapter.title} — Task ${n}`,
        status: 'not_started' as const,
      })),
    })),
  }));
}

export function buildSeedState(): StudentState {
  return {
    studentId: STUDENT_ID,
    coins: 0,
    streak: 0,
    todayFocusMinutes: 0,
    lastStreakDate: '',
    subjects: buildSubjects(),
    sessions: [],
  };
}
