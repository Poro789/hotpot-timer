function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 当前平台是否支持系统通知（iOS Safari 等不支持） */
export function notifySupported(): boolean {
  return supported();
}

/**
 * 在用户手势上下文中请求权限并返回结果（仅 default 时真正弹窗；
 * 已授权/已拒绝直接返回当前状态，不重复打扰）。
 */
export async function requestNotifyPermission(): Promise<'granted' | 'denied'> {
  if (!supported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
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
