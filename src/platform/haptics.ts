/** 震动反馈（不支持的平台静默忽略） */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 忽略 */
  }
}
