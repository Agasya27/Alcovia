import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSubjects, useSyllabusStore } from '../store/syllabusStore';
import { computeAllProgress } from '../utils/progress';
import type { TaskStatus } from '../types';
import { card, colors, radius, space, type } from '../theme';

const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
};

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${percent}%` }]} />
    </View>
  );
}

export default function SyllabusScreen() {
  const subjects = useSubjects();
  const updateTaskStatus = useSyllabusStore((s) => s.updateTaskStatus);
  const deleteTask = useSyllabusStore((s) => s.deleteTask);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const progress = useMemo(() => computeAllProgress(subjects), [subjects]);
  const progressBySubject = useMemo(
    () => Object.fromEntries(progress.map((p) => [p.subjectId, p])),
    [progress],
  );

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function onDelete(subjectId: string, chapterId: string, taskId: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this task?')) return;
    void deleteTask(subjectId, chapterId, taskId);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Syllabus</Text>
      {subjects.map((subject) => {
        const sp = progressBySubject[subject.id];
        const open = expanded[subject.id];
        const chapterProgress = Object.fromEntries(
          (sp?.chapters ?? []).map((c) => [c.chapterId, c]),
        );
        return (
          <View key={subject.id} style={[card, styles.subjectCard]}>
            <Pressable style={styles.subjectHeader} onPress={() => toggle(subject.id)}>
              <View style={styles.titleRow}>
                <Text style={styles.chevron}>{open ? '–' : '+'}</Text>
                <Text style={styles.subjectTitle}>{subject.title}</Text>
              </View>
              <Text style={styles.percent}>{sp?.percent ?? 0}%</Text>
            </Pressable>
            <ProgressBar percent={sp?.percent ?? 0} />

            {open &&
              subject.chapters.map((chapter) => {
                const cp = chapterProgress[chapter.id];
                const cOpen = expanded[chapter.id];
                const visibleTasks = chapter.tasks.filter((t) => t.deletedAt === undefined);
                return (
                  <View key={chapter.id} style={styles.chapterBlock}>
                    <Pressable style={styles.chapterHeader} onPress={() => toggle(chapter.id)}>
                      <View style={styles.titleRow}>
                        <Text style={styles.chevronSmall}>{cOpen ? '–' : '+'}</Text>
                        <Text style={styles.chapterTitle}>{chapter.title}</Text>
                      </View>
                      <Text style={styles.percentSmall}>{cp?.percent ?? 0}%</Text>
                    </Pressable>
                    <ProgressBar percent={cp?.percent ?? 0} />

                    {cOpen && (
                      <View style={styles.taskList}>
                        {visibleTasks.map((task) => (
                          <View key={task.id} style={styles.taskRow}>
                            <Text style={styles.taskTitle} numberOfLines={1}>
                              {task.title}
                            </Text>
                            <View style={styles.taskControls}>
                              <Pressable
                                style={[styles.statusPill, statusStyle(task.status)]}
                                onPress={() =>
                                  updateTaskStatus(
                                    subject.id,
                                    chapter.id,
                                    task.id,
                                    NEXT_STATUS[task.status],
                                  )
                                }
                              >
                                <View style={[styles.statusDot, statusDot(task.status)]} />
                                <Text style={[styles.statusText, statusText(task.status)]}>
                                  {STATUS_LABEL[task.status]}
                                </Text>
                              </Pressable>
                              <Pressable
                                style={styles.deleteBtn}
                                accessibilityLabel="Delete task"
                                onPress={() => onDelete(subject.id, chapter.id, task.id)}
                              >
                                <Text style={styles.deleteText}>×</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        );
      })}
    </ScrollView>
  );
}

function statusStyle(status: TaskStatus) {
  if (status === 'done') return { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft };
  if (status === 'in_progress') return { backgroundColor: colors.warnSoft, borderColor: colors.warnSoft };
  return { backgroundColor: colors.surfaceMuted, borderColor: colors.border };
}
function statusDot(status: TaskStatus) {
  if (status === 'done') return { backgroundColor: colors.accent };
  if (status === 'in_progress') return { backgroundColor: colors.warn };
  return { backgroundColor: colors.muted };
}
function statusText(status: TaskStatus) {
  if (status === 'done') return { color: colors.accent };
  if (status === 'in_progress') return { color: colors.warn };
  return { color: colors.inkSoft };
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md },
  heading: { ...type.h1, color: colors.ink, marginBottom: space.xs },

  subjectCard: { padding: space.lg, gap: space.md },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  chevron: { fontSize: 20, color: colors.muted, width: 16, textAlign: 'center' },
  chevronSmall: { fontSize: 16, color: colors.muted, width: 14, textAlign: 'center' },
  subjectTitle: { ...type.h2, color: colors.ink, flexShrink: 1 },
  percent: { ...type.body, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  percentSmall: {
    ...type.small,
    color: colors.inkSoft,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  barFill: { height: '100%', backgroundColor: colors.accent },

  chapterBlock: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterTitle: { ...type.body, color: colors.inkSoft, fontWeight: '600', flexShrink: 1 },

  taskList: { gap: space.xs, marginTop: space.xs },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingLeft: space.lg,
  },
  taskTitle: { ...type.body, color: colors.ink, flexShrink: 1, marginRight: space.sm },
  taskControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { ...type.label },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteText: { fontSize: 18, color: colors.muted, lineHeight: 20 },
});
