import { describe, expect, it } from 'vitest';
import { CATEGORIES, foodDatabase } from '../../src/core/catalog';

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

  it('三档时长严格递增，time 等于适中档', () => {
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      for (const food of foodDatabase[cat]) {
        const { rare, medium, wellDone } = food.times;
        expect(rare < medium && medium < wellDone, `${food.name} 三档未递增`).toBe(true);
        expect(food.time, `${food.name} time 应等于适中档`).toBe(medium);
      }
    }
  });

  it('三档判据均非空', () => {
    for (const cat of Object.keys(foodDatabase) as Array<keyof typeof foodDatabase>) {
      for (const food of foodDatabase[cat]) {
        for (const cue of Object.values(food.cues)) {
          expect(cue.trim().length, `${food.name} 判据为空`).toBeGreaterThan(0);
        }
      }
    }
  });
});
