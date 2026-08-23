import { expect, test } from '@playwright/test';

/**
 * 注意：addInitScript 回调会被序列化到浏览器执行，
 * 不能引用测试文件里的任何函数/常量，种子数据必须完全内联。
 */
test.describe('关键路径：完成流程 / 持久化 / 多标签', () => {
  test('计时完成 -> 时间到面板 -> 确认后消失', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'hotpot-timer-state-v2',
        JSON.stringify({
          version: 3,
          timers: [
            {
              id: 1,
              food: { baseName: '毛肚', name: '毛肚', totalMs: 15000, desc: '七上八下，口感脆' },
              remainingMs: 3000,
              state: 'running',
              endAt: Date.now() + 3000,
              missed: false,
            },
          ],
          myFoods: [],
          settings: { sound: false, vibrate: false, systemNotify: false },
          nextTimerId: 2,
          customFoodCounter: 1,
        }),
      );
    });
    await page.goto('/');
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toBeVisible();
    // 约 3 秒后到期：卡片转 completed，出现时间到面板
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toHaveClass(/completed/, {
      timeout: 10_000,
    });
    await expect(page.locator('#done-banner')).toBeVisible();
    await expect(page.locator('#done-banner')).toContainText('时间到');
    // 一键确认
    await page.locator('#done-confirm-all').click();
    await expect(page.locator('#done-banner')).toBeHidden();
  });

  test('离开期间到点：启动即补报（🕒 前缀）', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'hotpot-timer-state-v2',
        JSON.stringify({
          version: 3,
          timers: [
            {
              id: 1,
              food: { baseName: '毛肚', name: '毛肚', totalMs: 15000, desc: '七上八下，口感脆' },
              remainingMs: 10000,
              state: 'running',
              endAt: Date.now() - 5000,
              missed: false,
            },
          ],
          myFoods: [],
          settings: { sound: false, vibrate: false, systemNotify: false },
          nextTimerId: 2,
          customFoodCounter: 1,
        }),
      );
    });
    await page.goto('/');
    await expect(page.locator('#done-banner')).toBeVisible();
    await expect(page.locator('#done-banner')).toContainText('离开时已到点');
    await expect(page.locator('.done-item-name')).toContainText('🕒');
    await page.locator('.done-item-btn').click();
    await expect(page.locator('#done-banner')).toBeHidden();
  });

  test('添加计时后重载仍在（持久化，运行中继续）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toBeVisible();
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toHaveClass(/running/);
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toBeVisible();
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toHaveClass(/running/);
  });

  test('双标签同步：A 添加/删除，B 实时跟进', async ({ page, context }) => {
    const b = await context.newPage();
    await page.goto('/');
    await b.goto('/');
    await b.waitForSelector('.food-card');

    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await expect(page.locator('.timer-card')).toHaveCount(1);
    // storage 事件驱动 B 重新水合
    await expect(b.locator('.timer-card[data-timer-id="1"]')).toBeVisible({ timeout: 5_000 });

    // 删除按钮（卡片内第二个 data-id 按钮）
    await page.locator('.timer-card [data-id="1"]').last().click();
    await expect(page.locator('.timer-card')).toHaveCount(0);
    await expect.poll(async () => b.locator('.timer-card').count(), { timeout: 5_000 }).toBe(0);
    await b.close();
  });
});
