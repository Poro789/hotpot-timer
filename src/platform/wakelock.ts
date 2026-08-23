interface WakeLockLike {
  release(): Promise<void>;
}

let lock: WakeLockLike | null = null;

/**
 * 计时进行中保持屏幕常亮（守锅场景）。
 * 页面从后台回前台时系统可能回收 lock，由调用方在 visibilitychange 里重新调用。
 */
export async function setWakeLock(active: boolean): Promise<void> {
  try {
    if (!active) {
      if (lock) {
        await lock.release().catch(() => {});
        lock = null;
      }
      return;
    }
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> };
    };
    if (!nav.wakeLock) return;
    if (!lock) {
      lock = await nav.wakeLock.request('screen');
    }
  } catch {
    lock = null; // 不支持/被拒：静默降级
  }
}
