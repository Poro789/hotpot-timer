import { expect, test, type Page } from '@playwright/test';

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

  test('删除未确认的到点条目：确认面板不留空行', async ({ page }) => {
    // 种子：done + missed=true -> 启动即静默补报，面板出现一行
    await page.addInitScript(() => {
      localStorage.setItem(
        'hotpot-timer-state-v2',
        JSON.stringify({
          version: 3,
          timers: [
            {
              id: 1,
              food: { baseName: '毛肚', name: '毛肚', totalMs: 15000, desc: '七上八下，口感脆' },
              remainingMs: 0,
              state: 'done',
              endAt: Date.now() - 5000,
              missed: true,
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
    await expect(page.locator('.done-item')).toHaveCount(1);
    // 未点「知道了」就把卡片删掉：面板必须跟着清掉该条目
    // （旧行为：告警队列不跟计时列表对账 -> 面板残留一行空名字）
    await page.locator('.timer-card[data-timer-id="1"] .btn-delete').click();
    await expect(page.locator('.done-item')).toHaveCount(0);
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

  test('双标签页不来回写盘：B 水合后不回写，静置时存储安静', async ({ page, context }) => {
    // 计数写盘与收到的 storage 事件。回调会被序列化到浏览器执行，KEY 必须内联。
    await context.addInitScript(() => {
      const KEY = 'hotpot-timer-state-v2';
      const w = window as unknown as { writes: number; events: number };
      w.writes = 0;
      w.events = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, k: string, v: string): void {
        if (k === KEY) w.writes += 1;
        orig.call(this, k, v);
      };
      window.addEventListener('storage', (e) => {
        if (e.key === KEY) w.events += 1;
      });
    });

    const b = await context.newPage();
    await page.goto('/');
    await b.goto('/');
    await b.waitForSelector('.food-card');

    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await expect(page.locator('.timer-card')).toHaveCount(1);
    await expect(b.locator('.timer-card[data-timer-id="1"]')).toBeVisible({ timeout: 5_000 });

    const read = (p: Page): Promise<number[]> =>
      p.evaluate(() => {
        const w = window as unknown as { writes: number; events: number };
        return [w.writes, w.events];
      });

    // 毛肚 15s，此刻还没到点：接下来 4s 内没有任何用户操作，也不该有任何状态变化
    const beforeA = await read(page);
    const beforeB = await read(b);
    await b.waitForTimeout(4_000);
    const afterA = await read(page);
    const afterB = await read(b);

    // 只有发起方写盘：B 收到一次事件后不回写，A 因此一个事件都收不到。
    // 旧接线会来回 3 次写盘（实测 A:3 写/2 事件，B:2 写/2 事件）。
    expect(beforeA[0]!).toBeGreaterThanOrEqual(1);
    expect(beforeB[1]!).toBe(1);
    expect(beforeA[1]!).toBe(0);
    expect(beforeB[0]!).toBe(0);
    // 静置 4s（15s 的计时器还没到点、没有用户操作）：不该再有写盘
    expect(afterA[0]! - beforeA[0]!).toBeLessThanOrEqual(1);
    expect(afterB[0]! - beforeB[0]!).toBeLessThanOrEqual(1);
    await b.close();
  });

  test('同名两份：删掉一份后，剩下的卡片标题不再带 x2', async ({ page }) => {
    await page.goto('/');
    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    await expect(page.locator('.timer-card')).toHaveCount(2);
    // 两份都在时，两张卡片都标 x2（份数是同一份读数，不是「一份标一份不标」）
    await expect(page.locator('.timer-food-name')).toHaveText(['🥩 毛肚x2', '🥩 毛肚x2']);

    await page.locator('.timer-card[data-timer-id="1"] [data-id="1"]').last().click();
    await expect(page.locator('.timer-card')).toHaveCount(1);
    await expect(page.locator('.timer-food-name')).toHaveText('🥩 毛肚');
  });
});
