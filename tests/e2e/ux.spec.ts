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

  test('设置行只有声音开关+音量：声音开关有即时反馈，静音时音量条禁用', async ({ page }) => {
    await page.goto('/');
    // 震动/通知开关已移除
    await expect(page.locator('#set-vibrate')).toHaveCount(0);
    await expect(page.locator('#set-notify')).toHaveCount(0);
    // 声音：默认开启 -> 关闭 -> 再开启
    await page.locator('#set-sound').click();
    await expect(page.locator('#toast')).toContainText('声音提醒已关闭');
    await expect(page.locator('#set-sound')).toHaveText(/🔇/);
    await expect(page.locator('#set-volume')).toBeDisabled();
    await page.locator('#set-sound').click();
    await expect(page.locator('#toast')).toContainText('声音提醒已开启');
    await expect(page.locator('#set-sound')).toHaveText(/🔊/);
    await expect(page.locator('#set-volume')).toBeEnabled();
    // 声音与音量在同一行（flex 居中对齐：比较垂直中心，两者高度不同）
    const soundBox = await page.locator('#set-sound').boundingBox();
    const volumeBox = await page.locator('.volume-wrap').boundingBox();
    expect(soundBox).not.toBeNull();
    expect(volumeBox).not.toBeNull();
    const soundCenter = soundBox!.y + soundBox!.height / 2;
    const volumeCenter = volumeBox!.y + volumeBox!.height / 2;
    expect(Math.abs(soundCenter - volumeCenter)).toBeLessThan(4);
    // 音量在声音右侧
    expect(volumeBox!.x).toBeGreaterThan(soundBox!.x);
  });

  test('添加提示单行显示；完成卡"加一份"按钮单行', async ({ page }) => {
    // 预置一个已完成计时（按钮显示"加一份"）
    await page.addInitScript(() => {
      localStorage.setItem(
        'hotpot-timer-state-v2',
        JSON.stringify({
          version: 3,
          timers: [
            {
              id: 1,
              food: { baseName: '毛肚', name: '毛肚', totalMs: 15000, desc: '' },
              remainingMs: 0,
              state: 'done',
              endAt: null,
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
    // "加一份"按钮：文字单行（高度不超 min-height 36 + 边框余量）
    const addBtn = page.locator('.timer-card .btn-toggle');
    await expect(addBtn).toHaveText('加一份');
    const addBox = await addBtn.boundingBox();
    expect(addBox).not.toBeNull();
    expect(addBox!.height).toBeLessThan(42);
    // 点一个肉类食材（默认肉类页；"虾"在海鲜类）：toast 只报菜名、单行
    await page.locator('.food-card', { hasText: '鸭胗' }).first().click();
    await expect(page.locator('#toast')).toHaveText('已添加 🦆 鸭胗');
    const toastBox = await page.locator('#toast').boundingBox();
    expect(toastBox).not.toBeNull();
    // 单行 ≈ 46px；若折成两行会到 ~67px，用 56 区分
    expect(toastBox!.height).toBeLessThan(56);
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
    // 守锅按钮已按需求移除，全局控制只剩两个
    await expect(page.locator('#watch-mode-btn')).toHaveCount(0);
    for (const id of ['pause-all-btn', 'delete-all-btn']) {
      const btn = page.locator(`#${id}`);
      // 高度应接近 min-height（44px），而不是两行文字撑高（约 66px+）
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThan(60);
    }
  });
});
