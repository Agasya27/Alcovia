import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSubjects, useSyllabusStore } from '../store/syllabusStore';
import { computeAllProgress } from '../utils/progress';
import type { TaskStatus } from '../types';

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
    <ScrollView contentContainerStyle={styles.container}>
      {subjects.map((subject) => {
        const sp = progressBySubject[subject.id];
        const chapterProgress = Object.fromEntries(
          (sp?.chapters ?? []).map((c) => [c.chapterId, c]),
        );
        return (
          <View key={subject.id} style={styles.card}>
            <Pressable style={styles.rowHeader} onPress={() => toggle(subject.id)}>
              <Text style={styles.subjectTitle}>
                {expanded[subject.id] ? '▼' : '▶'} {subject.title}
              </Text>
              <View style={styles.rowRight}>
                <ProgressBar percent={sp?.percent ?? 0} />
                <Text style={styles.percentText}>{sp?.percent ?? 0}%</Text>
              </View>
            </Pressable>

            {expanded[subject.id] &&
              subject.chapters.map((chapter) => {
                const cp = chapterProgress[chapter.id];
                const visibleTasks = chapter.tasks.filter((t) => t.deletedAt === undefined);
                return (
                  <View key={chapter.id} style={styles.chapterBlock}>
                    <Pressable style={styles.rowHeader} onPress={() => toggle(chapter.id)}>
                      <Text style={styles.chapterTitle}>
                        {expanded[chapter.id] ? '▼' : '▶'} {chapter.title}
                      </Text>
                      <View style={styles.rowRight}>
                        <ProgressBar percent={cp?.percent ?? 0} />
                        <Text style={styles.percentText}>{cp?.percent ?? 0}%</Text>
                      </View>
                    </Pressable>

                    {expanded[chapter.id] &&
                      visibleTasks.map((task) => (
                        <View key={task.id} style={styles.taskRow}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <View style={styles.taskControls}>
                            <Pressable
                              style={[styles.statusPicker, statusStyle(task.status)]}
                              onPress={() =>
                                updateTaskStatus(
                                  subject.id,
                                  chapter.id,
                                  task.id,
                                  NEXT_STATUS[task.status],
                                )
                              }
                            >
                              <Text style={styles.statusText}>{STATUS_LABEL[task.status]}</Text>
                            </Pressable>
                            <Pressable
                              style={styles.deleteButton}
                              onPress={() => onDelete(subject.id, chapter.id, task.id)}
                            >
                              <Text style={styles.deleteText}>🗑</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
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
  switch (status) {
    case 'done':
      return { backgroundColor: '#dcfce7' };
    case 'in_progress':
      return { backgroundColor: '#fef9c3' };
    default:
      return { backgroundColor: '#e5e7eb' };
  }
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  chapterTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1, color: '#374151' },
  percentText: { fontSize: 12, fontWeight: '700', width: 38, textAlign: 'right' },
  barTrack: {
    width: 100,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#4f46e5' },
  chapterBlock: { paddingLeft: 12, marginTop: 4 },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  taskTitle: { fontSize: 13, color: '#111827', flexShrink: 1, marginRight: 8 },
  taskControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPicker: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
  statusText: { fontSize: 12, fontWeight: '600' },
  deleteButton: { padding: 6 },
  deleteText: { fontSize: 16 },
});
