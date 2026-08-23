import { describe, expect, it } from 'vitest';
import { CATEGORIES, FOOD_COUNTS, foodDatabase } from '../../src/core/catalog';

describe('食材目录（数据完整性）', () => {
  it('六个分类齐全且非空', () => {
    expect(CATEGORIES).toHaveLength(6);
    for (const cat of CATEGORIES) {
      expect(foodDatabase[cat.id]?.length, `分类 ${cat.id} 为空`).toBeGreaterThan(0);
    }
  });

  it('每条食材：时长为正整数，desc 非空', () => {
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      for (const food of foodDatabase[cat]) {
        expect(Number.isInteger(food.time) && food.time > 0, `${food.name} 时长非法`).toBe(true);
        expect(food.name.trim().length).toBeGreaterThan(0);
        expect(food.desc.length).toBeGreaterThan(0);
      }
    }
  });

  it('名称全局唯一', () => {
    const seen = new Map<string, string>();
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      for (const food of foodDatabase[cat]) {
        const dup = seen.get(food.name);
        if (dup) throw new Error(`重复名称「${food.name}」出现在 ${dup} 和 ${cat}`);
        seen.set(food.name, cat);
      }
    }
  });

  it('FOOD_COUNTS 与实际条目数一致', () => {
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      expect(FOOD_COUNTS[cat]).toBe(foodDatabase[cat].length);
    }
  });
});
