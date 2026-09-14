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

/**
 * 一声双音提示（880Hz→1245Hz 快速上行 + 短促尾音，约 0.55s）。
 * 比单音正弦在嘈杂环境（火锅店）里辨识度更高。volume: 0..1
 */
export function beep(volume: number): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const v = Math.min(1, Math.max(0.05, volume));
    // 上行两音：A5(880Hz) 短促 -> 升到 E6(1245Hz) 收尾
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.setValueAtTime(1245, t0 + 0.14);
    gain.gain.setValueAtTime(v, t0);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.5);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  } catch {
    /* 音频不可用：静默 */
  }
}
