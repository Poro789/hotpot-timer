/** 当前平台是否支持震动（桌面浏览器/iOS Safari 通常不支持） */
export function vibrateSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** 震动反馈（不支持的平台静默忽略） */
export function vibrate(pattern: number | number[]): void {
  if (!vibrateSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 忽略 */
  }
}
