import { expect, test } from '@playwright/test';

test.describe('冒烟：应用启动与基本交互', () => {
  test('页面加载后渲染肉类食材网格', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    // 肉类分类 21 条（与 src/core/catalog.ts 保持一致）
    await expect(page.locator('.food-card')).toHaveCount(21);
    await expect(page.locator('.tab-btn.active')).toHaveText('肉类');
    expect(errors, `页面 JS 异常: ${errors.join(' | ')}`).toEqual([]);
  });

  test('点食材卡片 -> 计时卡出现并运行', async ({ page }) => {
    await page.goto('/');
    await page.locator('.food-card', { hasText: '毛肚' }).first().click();
    const card = page.locator('.timer-card[data-timer-id="1"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/running/);
    await expect(card.locator('.timer-time')).toHaveText('15秒');
    // 食物网格出现选中角标
    await expect(page.locator('.food-card.selected')).toBeVisible();
  });

  test('切换分类渲染对应食材', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tab-btn[data-category="seafood"]').click();
    await expect(page.locator('.food-card')).toHaveCount(10);
    await expect(page.locator('.tab-btn.active')).toHaveText('海鲜');
  });
});
