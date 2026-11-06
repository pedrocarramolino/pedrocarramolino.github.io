'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import type { Group, Lesson, Student, TaskWithAssignments } from '@/lib/types';

export type LessonDraft = {
  lesson?: Lesson;
  start?: Date;
  studentId?: string;
  groupId?: string;
};
export type TaskDraft = {
  task?: TaskWithAssignments;
  studentIds?: string[];
  groupId?: string;
  week?: string;
  lessonId?: string;
};

type Modal =
  | { kind: 'student'; student?: Student }
  | { kind: 'group'; group?: Group }
  | { kind: 'lesson'; draft: LessonDraft }
  | { kind: 'task'; draft: TaskDraft }
  | { kind: 'palette' }
  | null;

interface UiStore {
  modal: Modal;
  close: () => void;
  openStudent: (student?: Student) => void;
  openGroup: (group?: Group) => void;
  openLesson: (draft?: LessonDraft) => void;
  openTask: (draft?: TaskDraft) => void;
  openPalette: () => void;
}

const Ctx = createContext<UiStore | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<Modal>(null);
  const store = useMemo<UiStore>(
    () => ({
      modal,
      close: () => setModal(null),
      openStudent: (student) => setModal({ kind: 'student', student }),
      openGroup: (group) => setModal({ kind: 'group', group }),
      openLesson: (draft = {}) => setModal({ kind: 'lesson', draft }),
      openTask: (draft = {}) => setModal({ kind: 'task', draft }),
      openPalette: () => setModal({ kind: 'palette' }),
    }),
    [modal],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useUi() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useUi fuera de UiProvider');
  return s;
}
