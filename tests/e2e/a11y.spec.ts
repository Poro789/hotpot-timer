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
    await page.locator('.food-add-btn').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.timer-card')).toHaveCount(1);
  });

  test('空格也加一份，且不重复触发（真实 button 后不能再叠自定义 keydown）', async ({ page }) => {
    await page.goto('/');
    await page.locator('.food-add-btn').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.timer-card')).toHaveCount(1);
    // 重绘后焦点还在原来那张卡上（键盘连加多份不用重新 Tab）
    await expect(page.locator('.food-add-btn').first()).toBeFocused();
    await page.keyboard.press(' ');
    await expect(page.locator('.timer-card')).toHaveCount(2);
  });

  test('分类标签是完整 tab 模式：面板关联 + 左右键切换', async ({ page }) => {
    await page.goto('/');
    const tabs = page.locator('.tab-btn');
    await expect(tabs.first()).toHaveAttribute('aria-controls', 'food-tabpanel');
    // roving tabindex：一次只有一个标签在 Tab 序列里
    await expect(tabs.first()).toHaveAttribute('tabindex', '0');
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#food-tabpanel')).toHaveAttribute('aria-labelledby', 'tab-meat');

    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-seafood')).toBeFocused();
    await expect(page.locator('#tab-seafood')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#food-tabpanel')).toHaveAttribute('aria-labelledby', 'tab-seafood');
    // 面板内容跟着换：海鲜 22 项
    await expect(page.locator('.food-card')).toHaveCount(22);

    await page.keyboard.press('End');
    await expect(page.locator('#tab-myfoods')).toBeFocused();
    await expect(page.locator('#my-foods-panel')).toBeVisible();
    await page.keyboard.press('Home');
    await expect(page.locator('#tab-meat')).toBeFocused();
    await expect(page.locator('#my-foods-panel')).toBeHidden();
  });

  test('食材卡：真实 button、不嵌套可交互元素、不用 aria-pressed 谎报状态', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.food-card').first();
    await expect(card.locator('.food-add-btn')).toHaveCount(1);
    const shape = await page.evaluate(() => {
      const c = document.querySelector('.food-card')!;
      return {
        cardRole: c.getAttribute('role'),
        cardTabindex: c.getAttribute('tabindex'),
        roleButtonDivs: document.querySelectorAll('.food-card [role="button"]').length,
      };
    });
    expect(shape).toEqual({ cardRole: null, cardTabindex: null, roleButtonDivs: 0 });
    // 点一下是「再加一份」，不是开关：不用 aria-pressed
    await card.click();
    await expect(card).not.toHaveAttribute('aria-pressed');
    await expect(card.locator('.food-add-btn')).toHaveAccessibleName(/再加一份/);
  });

  test('「我的食材」：删除按钮与添加按钮同级，不嵌在可交互元素里', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tab-myfoods').click();
    await page.locator('#custom-food-name').fill('测试食材');
    await page.locator('.time-chip[data-time="60"]').click();
    await page.locator('#add-custom-food-btn').click();
    await expect(page.locator('.food-card-custom')).toHaveCount(1);
    const shape = await page.evaluate(() => {
      const c = document.querySelector('.food-card-custom')!;
      const add = c.querySelector('.food-add-btn')!;
      const del = c.querySelector('.food-remove-btn')!;
      return {
        addExists: !!add,
        delExists: !!del,
        delInsideAdd: !!add.querySelector('.food-remove-btn'),
        sameParent: add.parentElement === del.parentElement,
      };
    });
    expect(shape).toEqual({
      addExists: true,
      delExists: true,
      delInsideAdd: false,
      sameParent: true,
    });
    await expect(page.locator('.food-remove-btn')).toHaveAccessibleName(/测试食材/);
  });

  test('计时列表容器带 role（无 role 的 div 上 aria-label 会被读屏忽略）', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#timers-container')).toHaveAttribute('role', 'region');
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
