'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/overlay';
import { studentName, useInvalidate } from '@/hooks/data';
import { studentApi } from '@/services/api';
import type { Student } from '@/lib/types';

export function useStudentActions() {
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const router = useRouter();

  const duplicate = async (s: Student) => {
    try {
      const id = await studentApi.duplicate(s.id);
      await invalidate('students', 'groups');
      toast.success('Alumno duplicado', { action: { label: 'Abrir', onClick: () => router.push(`/alumnos/${id}`) } });
      return id;
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setStatus = async (s: Student, status: Student['status']) => {
    try {
      await studentApi.update(s.id, { status });
      await invalidate('students');
      toast.success(status === 'archived' ? `${s.first_name} archivado` : status === 'active' ? `${s.first_name} reactivado` : `${s.first_name} marcado como inactivo`, {
        action: status === 'archived' ? { label: 'Deshacer', onClick: () => setStatus(s, s.status) } : undefined,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (s: Student) => {
    const ok = await confirm({
      title: `¿Eliminar a ${studentName(s)}?`,
      description: 'Se borrarán su ficha, sus clases, tareas, anotaciones y objetivos. Esta acción no se puede deshacer. Si solo ha dejado las clases, mejor archívalo.',
      confirmLabel: 'Eliminar definitivamente',
      danger: true,
    });
    if (!ok) return false;
    try {
      await studentApi.remove(s.id);
      await invalidate('students', 'lessons', 'tasks', 'groups', 'progress');
      toast.success('Alumno eliminado');
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  return { duplicate, setStatus, remove };
}
