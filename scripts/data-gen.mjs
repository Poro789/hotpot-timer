/**
 * 食材数据管线：CSV -> src/core/catalog.ts
 *
 * 用法：
 *   node scripts/data-gen.mjs          # 重新生成 catalog.ts
 *   node scripts/data-gen.mjs --check  # 仅校验：CSV 合法且与 catalog.ts 一致（CI 卡点）
 *
 * CSV schema（首行表头，带 BOM 容忍，字段可带双引号）：
 *   Name,Time,Category,ServingTip
 *   "🥩 毛肚","15","肉类","七上八下，口感脆"
 *
 * 校验规则：
 *   - 表头必须恰好为 Name,Time,Category,ServingTip
 *   - Name 非空且全局唯一（含 emoji 前缀）
 *   - Time 为正整数（秒）
 *   - Category 属于：肉类/海鲜类/蔬菜类/豆制品类/丸滑类/经典火锅菜
 *   - 行必须恰好 4 列
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_PATH = join(root, 'data', 'food_catalog.csv');
const OUT_PATH = join(root, 'src', 'core', 'catalog.ts');
const CHECK = process.argv.includes('--check');

const CATEGORY_MAP = {
  肉类: 'meat',
  海鲜类: 'seafood',
  蔬菜类: 'vegetable',
  豆制品类: 'bean',
  丸滑类: 'ball',
  经典火锅菜: 'other',
};
const CATEGORY_IDS = ['meat', 'seafood', 'vegetable', 'bean', 'ball', 'other'];
const CATEGORY_LABELS = {
  meat: '肉类',
  seafood: '海鲜',
  vegetable: '蔬菜',
  bean: '豆制品',
  ball: '丸类',
  other: '其他',
};

function fail(msg) {
  console.error(`[data-gen] ✗ ${msg}`);
  process.exitCode = 1;
}

/** 状态机 CSV 解析：支持双引号字段、引号内逗号、"" 转义、CRLF、BOM */
function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function tsString(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function renderCatalog(foods) {
  const lines = [];
  lines.push('/**');
  lines.push(' * 食材目录（由 scripts/data-gen.mjs 从 data/food_catalog.csv 生成）');
  lines.push(' *');
  lines.push(' * 本文件为生成物，请勿手改。');
  lines.push(' * 修改食材：编辑 CSV 后运行 `npm run data:gen`。');
  lines.push(' */');
  lines.push('');
  lines.push(
    "export type Category = 'meat' | 'seafood' | 'vegetable' | 'bean' | 'ball' | 'other';",
  );
  lines.push('');
  lines.push('export interface CatalogFood {');
  lines.push('  name: string;');
  lines.push('  /** 秒 */');
  lines.push('  time: number;');
  lines.push('  desc: string;');
  lines.push('}');
  lines.push('');
  lines.push('export const CATEGORIES: ReadonlyArray<{ id: Category; label: string }> = [');
  for (const id of CATEGORY_IDS) {
    lines.push(`  { id: '${id}', label: '${CATEGORY_LABELS[id]}' },`);
  }
  lines.push('];');
  lines.push('');
  lines.push('export const foodDatabase: Record<Category, CatalogFood[]> = {');
  for (const id of CATEGORY_IDS) {
    lines.push(`  ${id}: [`);
    for (const f of foods[id]) {
      lines.push(`    { name: ${tsString(f.name)}, time: ${f.time}, desc: ${tsString(f.desc)} },`);
    }
    lines.push('  ],');
  }
  lines.push('};');
  lines.push('');
  lines.push('/** 各分类食材数（界面角标/统计用） */');
  lines.push('export const FOOD_COUNTS: Record<Category, number> = {');
  for (const id of CATEGORY_IDS) {
    lines.push(`  ${id}: foodDatabase.${id}.length,`);
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function main() {
  let text;
  try {
    text = readFileSync(CSV_PATH, 'utf8');
  } catch {
    fail(`找不到 ${CSV_PATH}`);
    return;
  }
  const rows = parseCsv(text);
  if (rows.length < 2) {
    fail('CSV 缺少数据行');
    return;
  }
  const header = rows[0].map((h) => h.trim());
  const expectedHeader = ['Name', 'Time', 'Category', 'ServingTip'];
  if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
    fail(`表头不符：期望 ${expectedHeader.join(',')}，实际 ${header.join(',')}`);
    return;
  }

  const foods = Object.fromEntries(CATEGORY_IDS.map((id) => [id, []]));
  const seen = new Map();
  let errors = 0;

  rows.slice(1).forEach((row, i) => {
    const lineNo = i + 2;
    const [name, time, category, desc = ''] = row;
    if (row.length !== 4) {
      console.error(`[data-gen] ✗ 第 ${lineNo} 行列数 ${row.length} ≠ 4`);
      errors++;
      return;
    }
    const n = (name ?? '').trim();
    if (!n) {
      console.error(`[data-gen] ✗ 第 ${lineNo} 行 Name 为空`);
      errors++;
      return;
    }
    if (seen.has(n)) {
      console.error(
        `[data-gen] ✗ 第 ${lineNo} 行 Name 重复：${n}（首次出现于第 ${seen.get(n)} 行）`,
      );
      errors++;
      return;
    }
    seen.set(n, lineNo);
    if (!/^\d+$/.test((time ?? '').trim()) || Number(time) <= 0) {
      console.error(
        `[data-gen] ✗ 第 ${lineNo} 行 Time 非法：${JSON.stringify(time)}（需正整数秒）`,
      );
      errors++;
      return;
    }
    const id = CATEGORY_MAP[category];
    if (!id) {
      console.error(`[data-gen] ✗ 第 ${lineNo} 行 Category 非法：${JSON.stringify(category)}`);
      errors++;
      return;
    }
    foods[id].push({ name: n, time: Number(time), desc: (desc ?? '').trim() });
  });

  if (errors > 0) {
    fail(`CSV 校验失败（${errors} 处错误）`);
    return;
  }

  for (const id of CATEGORY_IDS) {
    if (foods[id].length === 0) {
      fail(`分类 ${id} 为空`);
      return;
    }
  }

  const total = CATEGORY_IDS.reduce((s, id) => s + foods[id].length, 0);
  const summary = CATEGORY_IDS.map((id) => `${id}=${foods[id].length}`).join(', ');
  console.log(`[data-gen] ✓ 校验通过：共 ${total} 项（${summary}）`);

  const generated = renderCatalog(foods);
  if (CHECK) {
    const existing = readFileSync(OUT_PATH, 'utf8');
    if (existing !== generated) {
      fail(`${OUT_PATH} 与 CSV 不同步。请运行 \`npm run data:gen\` 后提交。`);
      return;
    }
    console.log(`[data-gen] ✓ ${OUT_PATH} 与 CSV 同步`);
  } else {
    writeFileSync(OUT_PATH, generated, 'utf8');
    console.log(`[data-gen] ✓ 已生成 ${OUT_PATH}`);
  }
}

main();
