import { expect, test } from '@playwright/test';

test.describe('无障碍必要集', () => {
  test('允许用户缩放（无 user-scalable=no）', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport ?? '').not.toContain('user-scalable=no');
  });

  test('到点播报区域存在（aria-live=assertive）', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#live-region[aria-live="assertive"]')).toBeAttached();
  });

  test('弹层焦点陷阱：Tab 循环不逃出弹层', async ({ page }) => {
    await page.goto('/');
    await page.locator('.quick-time-btn[data-time="60"]').click();
    await expect(page.locator('#quick-name-overlay.open')).toBeVisible();
    // 连续 Tab 8 次（超过弹层内 3 个可聚焦元素），焦点始终在弹层内
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      document.getElementById('quick-name-overlay')!.contains(document.activeElement),
    );
    expect(inside).toBe(true);
    // Esc 关闭
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-name-overlay')).toBeHidden();
  });

  test('食材卡片键盘可达（Enter 添加）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.food-card').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.timer-card')).toHaveCount(1);
  });

  test('prefers-reduced-motion：全屏提醒不闪烁', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // 手动触发闪光类，验证动画被降级
    const animation = await page.evaluate(() => {
      const el = document.getElementById('flash-overlay')!;
      el.classList.add('flashing');
      const v = getComputedStyle(el).animationName;
      el.classList.remove('flashing');
      return v;
    });
    expect(animation).toBe('none');
  });
});
