import { describe, expect, it } from 'vitest';
import { deriveDonenessStatus } from '../../src/core/types';

const TIMES = { rare: 10, medium: 15, wellDone: 25 };

describe('deriveDonenessStatus（熟度状态派生）', () => {
  it('未计时（elapsed=0）-> null（未开始）', () => {
    expect(deriveDonenessStatus(0, TIMES)).toBeNull();
  });

  it('elapsed < rare 档 -> rare（偏生）', () => {
    expect(deriveDonenessStatus(1_000, TIMES)).toBe('rare');
    expect(deriveDonenessStatus(9_999, TIMES)).toBe('rare');
  });

  it('rare <= elapsed < medium 档 -> medium（适中）', () => {
    expect(deriveDonenessStatus(10_000, TIMES)).toBe('medium');
    expect(deriveDonenessStatus(14_999, TIMES)).toBe('medium');
  });

  it('elapsed >= medium 档 -> wellDone（偏熟）', () => {
    expect(deriveDonenessStatus(15_000, TIMES)).toBe('wellDone');
    expect(deriveDonenessStatus(25_000, TIMES)).toBe('wellDone');
    expect(deriveDonenessStatus(60_000, TIMES)).toBe('wellDone');
  });

  it('无三档阈值（自定义/快速计时）-> null', () => {
    expect(deriveDonenessStatus(5_000, undefined)).toBeNull();
    expect(deriveDonenessStatus(0, undefined)).toBeNull();
  });
});