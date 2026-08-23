/**
 * 屏幕阅读器播报（aria-live=assertive 区域）。
 * 先清空再写入，保证重复消息也能被重新播报。
 */
export function announce(region: HTMLElement | null, message: string): void {
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
