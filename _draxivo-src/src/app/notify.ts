// Notificaciones locales del descanso. No usan servidor: las genera el propio dispositivo
// mientras la app sigue ejecutándose (en primer plano o en segundo plano).

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

export function notifyState(): NotifyState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifyState;
}

/** Pide permiso al usuario. Debe llamarse desde un gesto (toque). */
export async function requestNotifyPermission(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    return notifyState();
  }
}

const TAG = 'draxivo-rest';

/** Muestra el aviso de fin de descanso (a través del service worker cuando existe). */
export async function showRestNotification(body: string): Promise<boolean> {
  if (notifyState() !== 'granted') return false;
  const title = 'Descanso terminado';
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag: TAG,
    renotify: true,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: location.href },
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/** Cierra el aviso si sigue visible (al volver a la app o empezar otro descanso). */
export async function clearRestNotification() {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    const list = (await reg?.getNotifications({ tag: TAG })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    /* sin notificaciones */
  }
}
