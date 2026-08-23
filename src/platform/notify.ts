function supported(): boolean {
  return 'Notification' in window;
}

/** 在用户手势上下文中请求权限（仅 default 时） */
export function requestNotifyPermission(): void {
  if (supported() && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => {});
  }
}

/** 系统通知（兜底提醒；iOS Safari 等不支持时静默） */
export function systemNotify(message: string): void {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    new Notification('🔥 火锅计时器', { body: message });
  } catch {
    /* 忽略 */
  }
}
