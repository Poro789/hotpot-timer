let sharedCtx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    sharedCtx ??= new AC();
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** 首次用户手势时调用（移动端自动播放策略要求 AudioContext 由交互激活） */
export function unlockAudio(): void {
  void ensureCtx();
}

/** 一声短促提示音（800Hz 正弦，0.5s 衰减）。volume: 0..1 */
export function beep(volume: number): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 800;
    const v = Math.min(1, Math.max(0.05, volume));
    gain.gain.setValueAtTime(v, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* 音频不可用：静默 */
  }
}
