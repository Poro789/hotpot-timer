import { expect, test } from '@playwright/test';

test.describe('PWA：离线与 Service Worker', () => {
  test('SW 注册并控制页面', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(
        async () => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r)),
        { timeout: 15_000 },
      )
      .toBe(true);
    // 重载后获得控制权
    await page.reload();
    await expect
      .poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller), {
        timeout: 15_000,
      })
      .toBe(true);
  });

  test('离线可用：断网后重载，应用照常渲染并可添加计时', async ({ page }) => {
    await page.goto('/');
    // 等 SW 安装完成（预缓存写入）
    await expect
      .poll(async () => page.evaluate(() => !!navigator.serviceWorker.controller), {
        timeout: 15_000,
      })
      .toBe(true)
      .catch(() => {});
    await page.reload();
    await page.waitForSelector('.food-card');
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator('.food-card')).toHaveCount(21);
    // 离线状态下仍可交互
    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await expect(page.locator('.timer-card')).toHaveCount(1);
  });

  test('manifest 与图标可达（PNG 有效）', async ({ request, page }) => {
    await page.goto('/');
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const m = await manifest.json();
    expect(m.name).toContain('火锅计时器');
    expect(m.display).toBe('standalone');
    for (const icon of m.icons as Array<{ src: string }>) {
      const res = await request.get(`/${icon.src}`);
      expect(res.ok(), `图标缺失: ${icon.src}`).toBeTruthy();
      const buf = await res.body();
      expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47'); // PNG magic
    }
  });
});
