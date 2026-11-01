import { expect, test, type Page } from '@playwright/test';

/**
 * 到点提醒增强（commit 9f48569 的四项行为红线）：
 * 手法提示行 / 超时分级红色脉冲 / 阶段提示 toast / 同食材多份合并播报。
 *
 * 种子数据必须完全内联（addInitScript 会被序列化到浏览器执行）。
 */
type SeedFood = {
  baseName: string;
  name: string;
  totalMs: number;
  desc: string;
  technique?: string;
  overtime?: 'hard' | 'soft';
  midpoint?: number;
};

async function seed(page: Page, timers: SeedTimer[]): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem(
      'hotpot-timer-state-v2',
      JSON.stringify({
        version: 3,
        timers: data,
        myFoods: [],
        settings: { sound: false, vibrate: false, systemNotify: false },
        nextTimerId: data.length + 1,
        customFoodCounter: 1,
      }),
    );
  }, timers);
}

interface SeedTimer {
  id: number;
  food: SeedFood;
  remainingMs: number;
  state: 'running' | 'paused' | 'done';
  endAt: number;
  missed: boolean;
}

test.describe('到点提醒增强（手法 / 超时分级 / 阶段提示 / 合并播报）', () => {
  test('卡片显示手法提示行', async ({ page }) => {
    await seed(page, [
      {
        id: 1,
        food: {
          baseName: '毛肚',
          name: '毛肚',
          totalMs: 15_000,
          desc: '七上八下，口感脆',
          technique: '七上八下，抖散快烫',
          overtime: 'hard',
        },
        remainingMs: 15_000,
        state: 'running',
        endAt: Date.now() + 15_000,
        missed: false,
      },
    ]);
    await page.goto('/');
    const card = page.locator('.timer-card[data-timer-id="1"]');
    await expect(card.locator('.timer-technique')).toHaveText('🥢 七上八下，抖散快烫');
  });

  test('hard 类超时满 10 秒：时间转红色脉冲', async ({ page }) => {
    await seed(page, [
      {
        id: 1,
        food: {
          baseName: '毛肚',
          name: '毛肚',
          totalMs: 15_000,
          desc: '七上八下，口感脆',
          overtime: 'hard',
        },
        remainingMs: 0,
        state: 'running',
        // 已超时 11 秒：加载即补报，卡片按超时显示
        endAt: Date.now() - 11_000,
        missed: false,
      },
    ]);
    await page.goto('/');
    const time = page.locator('.timer-card[data-timer-id="1"] .timer-time');
    await expect(time).toHaveClass(/overtime-hard/);
    await expect(time).toHaveText(/^\+1[1-9](\.\d)?秒$/);
  });

  test('soft 类与自定义食材：超时再久也不脉冲', async ({ page }) => {
    await seed(page, [
      {
        id: 1,
        food: {
          baseName: '猪蹄',
          name: '猪蹄',
          totalMs: 60_000,
          desc: '久煨入味',
          overtime: 'soft',
        },
        remainingMs: 0,
        state: 'running',
        endAt: Date.now() - 30_000,
        missed: false,
      },
      {
        id: 2,
        food: { baseName: '自定义', name: '自定义食材1', totalMs: 20_000, desc: '' },
        remainingMs: 0,
        state: 'running',
        endAt: Date.now() - 30_000,
        missed: false,
      },
    ]);
    await page.goto('/');
    await expect(page.locator('.timer-card[data-timer-id="1"] .timer-time')).not.toHaveClass(
      /overtime-hard/,
    );
    await expect(page.locator('.timer-card[data-timer-id="2"] .timer-time')).not.toHaveClass(
      /overtime-hard/,
    );
  });

  test('阶段提示：过了 midpoint 比例提示检查一次', async ({ page }) => {
    await seed(page, [
      {
        id: 1,
        food: {
          baseName: '鲜鸭血',
          name: '鲜鸭血',
          totalMs: 4_000,
          desc: '沉底入味',
          midpoint: 0.5,
        },
        remainingMs: 4_000,
        state: 'running',
        endAt: Date.now() + 4_000,
        missed: false,
      },
    ]);
    await page.goto('/');
    // 阈值 = 4000 * 0.5 = 2s：约 2 秒后出现"该检查一下了"
    await expect(page.locator('#toast')).toContainText('🔍 鲜鸭血 该检查一下了', {
      timeout: 8_000,
    });
    // 到点后再等一轮，不应重复提示（toast 队列若重复会出现第二次）
    await expect(page.locator('.timer-card[data-timer-id="1"]')).toHaveClass(/completed/, {
      timeout: 8_000,
    });
    await page.waitForTimeout(1_000);
    await expect(page.locator('#toast')).toHaveText('🔍 鲜鸭血 该检查一下了');
  });

  test('同食材多份：只合并播报一次（×N）', async ({ page }) => {
    await seed(page, [
      {
        id: 1,
        food: { baseName: '毛肚', name: '毛肚', totalMs: 15_000, desc: '七上八下，口感脆' },
        remainingMs: 2_000,
        state: 'running',
        endAt: Date.now() + 2_000,
        missed: false,
      },
      {
        id: 2,
        food: { baseName: '毛肚', name: '毛肚', totalMs: 15_000, desc: '七上八下，口感脆' },
        remainingMs: 2_000,
        state: 'running',
        endAt: Date.now() + 2_000,
        missed: false,
      },
    ]);
    await page.goto('/');
    // 两条同时到点：播报按 baseName 合并为 "毛肚 ×2 时间到！"
    await expect(page.locator('#live-region')).toHaveText('毛肚 ×2 时间到！', { timeout: 8_000 });
    // 确认面板仍逐条列出（可分别确认）
    await expect(page.locator('#done-banner')).toBeVisible();
    await expect(page.locator('.done-item')).toHaveCount(2);
  });
});
