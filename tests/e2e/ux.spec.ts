import { expect, test } from '@playwright/test';

test.describe('交互体验与显示修复', () => {
  test('到点条目置顶：后添加的先完成，完成后自动排到最前', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'hotpot-timer-state-v2',
        JSON.stringify({
          version: 3,
          timers: [
            {
              id: 1,
              food: { baseName: '虾', name: '虾', totalMs: 15000, desc: '' },
              remainingMs: 10000,
              state: 'running',
              endAt: Date.now() + 10000,
              missed: false,
            },
            {
              id: 2,
              food: { baseName: '毛肚', name: '毛肚', totalMs: 15000, desc: '' },
              remainingMs: 2000,
              state: 'running',
              endAt: Date.now() + 2000,
              missed: false,
            },
          ],
          myFoods: [],
          settings: { sound: false, vibrate: false, systemNotify: false },
          nextTimerId: 3,
          customFoodCounter: 1,
        }),
      );
    });
    await page.goto('/');
    // 初始顺序：虾(1) 在前
    await expect(page.locator('.timer-card').first()).toHaveAttribute('data-timer-id', '1');
    // 约 2 秒后毛肚(2) 到点：时间到面板出现，且它被顶到第一位
    await expect(page.locator('#done-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.timer-card').first()).toHaveAttribute('data-timer-id', '2');
    await expect(page.locator('.timer-card').nth(1)).toHaveAttribute('data-timer-id', '1');
    // 完成卡显示"时间到"而不是"0秒"
    await expect(page.locator('.timer-card').first().locator('.timer-time')).toHaveText('时间到');
    await page.locator('#done-confirm-all').click();
    await expect(page.locator('#done-banner')).toBeHidden();
  });

  test('设置开关有即时反馈（toast + 状态切换）', async ({ page }) => {
    await page.goto('/');
    // 震动：默认开启 -> 点一次关闭 -> 再点开启
    await page.locator('#set-vibrate').click();
    await expect(page.locator('#toast')).toContainText('震动提醒已关闭');
    await expect(page.locator('#set-vibrate')).toHaveText(/📴/);
    await page.locator('#set-vibrate').click();
    await expect(page.locator('#toast')).toContainText('震动提醒已开启');
    await expect(page.locator('#set-vibrate')).toHaveText(/📳/);
    // 声音：关闭时给出反馈
    await page.locator('#set-sound').click();
    await expect(page.locator('#toast')).toContainText('声音提醒已关闭');
    await expect(page.locator('#set-sound')).toHaveText(/🔇/);
    // 恢复，避免影响其他用例的默认状态
    await page.locator('#set-sound').click();
  });

  test('守锅模式：点击后进入或优雅降级，按钮文案同步切换', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#watch-mode-btn')).toHaveText(/守锅/);
    await page.locator('#watch-mode-btn').click();
    // 两种合法结果：环境支持全屏 -> 按钮变"退出守锅"；
    // 不支持（如某些 headless 场景）-> 出现降级 toast。
    await expect
      .poll(
        async () => {
          const toast = (await page.locator('#toast').textContent()) ?? '';
          const label = (await page.locator('#watch-mode-btn').textContent()) ?? '';
          return toast.includes('不支持全屏') || label.includes('退出守锅');
        },
        { timeout: 5_000 },
      )
      .toBe(true);
    // 若进入了全屏，退出它，保证后续用例干净
    const label = (await page.locator('#watch-mode-btn').textContent()) ?? '';
    if (label.includes('退出守锅')) {
      await page.locator('#watch-mode-btn').click();
      await expect(page.locator('#watch-mode-btn')).not.toHaveText(/退出守锅/);
    }
  });

  test('manifest/图标引用为相对路径（Pages 子路径下可安装）', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('./manifest.webmanifest');
    const iconHref = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(iconHref).toBe('./icon-192.png');
  });

  test('全局按钮单行显示不折行', async ({ page }) => {
    await page.goto('/');
    for (const id of ['pause-all-btn', 'delete-all-btn', 'watch-mode-btn']) {
      const btn = page.locator(`#${id}`);
      // 高度应接近 min-height（44px），而不是两行文字撑高（约 66px+）
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThan(60);
    }
  });
});
