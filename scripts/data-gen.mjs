/**
 * 食材数据管线：CSV -> src/core/catalog.ts
 *
 * 用法：
 *   node scripts/data-gen.mjs          # 重新生成 catalog.ts
 *   node scripts/data-gen.mjs --check  # 仅校验：CSV 合法且与 catalog.ts 一致（CI 卡点）
 *
 * CSV schema v2（首行表头，带 BOM 容忍，字段可带双引号）：
 *   Name,Category,TimeRare,TimeMedium,TimeWellDone,CueRare,CueMedium,CueWellDone,RiskNote,ServingTip
 *
 *   三档时长（秒）：红绿灯 = 偏生(绿) / 适中(黄) / 偏熟(红)
 *   三档判据：每档"用眼睛确认"的熟成线索（颜色/形态/浮起）
 *   RiskNote：偏生档的安全提示（空 = 偏生无额外风险）
 *   ServingTip：通用熟度提示（旧列，保留）
 *
 * 校验规则：
 *   - 表头必须恰好为上述 10 列
 *   - Name 非空且全局唯一（含 emoji 前缀）
 *   - Category 属于：肉类/海鲜类/蔬菜类/豆制品类/丸滑类/经典火锅菜
 *   - 三档时长均为正整数（秒），且严格递增：Rare < Medium < WellDone
 *   - 三档判据均非空（红绿灯必须给出可目视确认的判据）
 *   - 行必须恰好 10 列
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

const HEADER = [
  'Name',
  'Category',
  'TimeRare',
  'TimeMedium',
  'TimeWellDone',
  'CueRare',
  'CueMedium',
  'CueWellDone',
  'RiskNote',
  'ServingTip',
  'Technique',
  'Overtime',
  'Midpoint',
];

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
  lines.push('/** 熟度档位：偏生（绿）/ 适中（黄）/ 偏熟（红） */');
  lines.push("export type Doneness = 'rare' | 'medium' | 'wellDone';");
  lines.push('');
  lines.push('export interface CatalogFood {');
  lines.push('  name: string;');
  lines.push('  /** 适中档时长（秒）——不选档时的默认值 */');
  lines.push('  time: number;');
  lines.push('  desc: string;');
  lines.push('  /** 三档时长（秒）：严格递增 rare < medium < wellDone */');
  lines.push('  times: Record<Doneness, number>;');
  lines.push('  /** 三档熟成判据（目视确认线索） */');
  lines.push('  cues: Record<Doneness, string>;');
  lines.push('  /** 偏生档安全提示；空串 = 无额外风险 */');
  lines.push('  risk: string;');
  lines.push('  /** 涮煮手法提示（一句话）；有明确手法时非空 */');
  lines.push('  technique?: string;');
  lines.push("  /** 超时后果：hard=多煮即老 / soft=多煮更入味 */");
  lines.push("  overtime?: 'hard' | 'soft';");
  lines.push('  /** 阶段提示：已过该比例时提醒检查（0~1） */');
  lines.push('  midpoint?: number;');
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
      const extra = [
        f.technique ? `technique: ${tsString(f.technique)}` : '',
        f.overtime ? `overtime: '${f.overtime}'` : '',
        f.midpoint !== undefined ? `midpoint: ${f.midpoint}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(
        `    { name: ${tsString(f.name)}, time: ${f.medium}, desc: ${tsString(f.desc)}, ` +
          `times: { rare: ${f.rare}, medium: ${f.medium}, wellDone: ${f.well} }, ` +
          `cues: { rare: ${tsString(f.cueRare)}, medium: ${tsString(f.cueMedium)}, wellDone: ${tsString(f.cueWell)} }, ` +
          `risk: ${tsString(f.risk)}${extra ? ', ' + extra : ''} },`,
      );
    }
    lines.push('  ],');
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
  if (JSON.stringify(header) !== JSON.stringify(HEADER)) {
    fail(`表头不符：期望 ${HEADER.join(',')}，实际 ${header.join(',')}`);
    return;
  }

  const foods = Object.fromEntries(CATEGORY_IDS.map((id) => [id, []]));
  const seen = new Map();
  let errors = 0;
  const err = (lineNo, msg) => {
    console.error(`[data-gen] ✗ 第 ${lineNo} 行 ${msg}`);
    errors++;
  };

  rows.slice(1).forEach((row, i) => {
    const lineNo = i + 2;
    if (row.length !== HEADER.length) {
      err(lineNo, `列数 ${row.length} ≠ ${HEADER.length}`);
      return;
    }
    const [name, category, tRare, tMed, tWell, cueRare, cueMed, cueWell, risk, desc, technique, overtime, midpoint] = row;
    const n = (name ?? '').trim();
    if (!n) {
      err(lineNo, 'Name 为空');
      return;
    }
    if (seen.has(n)) {
      err(lineNo, `Name 重复：${n}（首次出现于第 ${seen.get(n)} 行）`);
      return;
    }
    seen.set(n, lineNo);
    const id = CATEGORY_MAP[category];
    if (!id) {
      err(lineNo, `Category 非法：${JSON.stringify(category)}`);
      return;
    }
    const times = [tRare, tMed, tWell].map((t) => (t ?? '').trim());
    const bad = times.find((t) => !/^\d+$/.test(t) || Number(t) <= 0);
    if (bad !== undefined) {
      err(lineNo, `时长非法：${JSON.stringify(bad)}（三档均需正整数秒）`);
      return;
    }
    const [rare, medium, well] = times.map(Number);
    if (!(rare < medium && medium < well)) {
      err(lineNo, `三档时长必须严格递增：rare(${rare}) < medium(${medium}) < wellDone(${well})`);
      return;
    }
    const cues = [cueRare, cueMed, cueWell].map((c) => (c ?? '').trim());
    if (cues.some((c) => !c)) {
      err(lineNo, '三档判据均不能为空（红绿灯必须给出目视判据）');
      return;
    }
    const overtimeVal = (overtime ?? '').trim();
    if (overtimeVal && overtimeVal !== 'hard' && overtimeVal !== 'soft') {
      err(lineNo, `Overtime 非法：${JSON.stringify(overtimeVal)}（须为 hard/soft/空）`);
      return;
    }
    const midpointVal = (midpoint ?? '').trim();
    let midpointNum;
    if (midpointVal) {
      if (!/^\d+(\.\d+)?$/.test(midpointVal) || Number(midpointVal) <= 0 || Number(midpointVal) >= 1) {
        err(lineNo, `Midpoint 非法：${JSON.stringify(midpointVal)}（须为 0~1 小数/空）`);
        return;
      }
      midpointNum = Number(midpointVal);
    }
    foods[id].push({
      name: n,
      rare,
      medium,
      well,
      cueRare: cues[0],
      cueMedium: cues[1],
      cueWell: cues[2],
      risk: (risk ?? '').trim(),
      desc: (desc ?? '').trim(),
      technique: (technique ?? '').trim(),
      overtime: overtimeVal || undefined,
      midpoint: midpointNum,
    });
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