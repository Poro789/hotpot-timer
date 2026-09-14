/**
 * 食材目录（由 scripts/data-gen.mjs 从 data/food_catalog.csv 生成）
 *
 * 本文件为生成物，请勿手改。
 * 修改食材：编辑 CSV 后运行 `npm run data:gen`。
 */

export type Category = 'meat' | 'seafood' | 'vegetable' | 'bean' | 'ball' | 'other';

/** 熟度档位：偏生（绿）/ 适中（黄）/ 偏熟（红） */
export type Doneness = 'rare' | 'medium' | 'wellDone';

export interface CatalogFood {
  name: string;
  /** 适中档时长（秒）——不选档时的默认值 */
  time: number;
  desc: string;
  /** 三档时长（秒）：严格递增 rare < medium < wellDone */
  times: Record<Doneness, number>;
  /** 三档熟成判据（目视确认线索） */
  cues: Record<Doneness, string>;
  /** 偏生档安全提示；空串 = 无额外风险 */
  risk: string;
}

export const CATEGORIES: ReadonlyArray<{ id: Category; label: string }> = [
  { id: 'meat', label: '肉类' },
  { id: 'seafood', label: '海鲜' },
  { id: 'vegetable', label: '蔬菜' },
  { id: 'bean', label: '豆制品' },
  { id: 'ball', label: '丸类' },
  { id: 'other', label: '其他' },
];

export const foodDatabase: Record<Category, CatalogFood[]> = {
  meat: [
    { name: '🥩 毛肚', time: 15, desc: '七上八下，口感脆', times: { rare: 10, medium: 15, wellDone: 25 }, cues: { rare: '叶片微卷、根须变挺', medium: '七上八下后叶片舒展硬挺、表面挂汁', wellDone: '叶片卷紧发硬' }, risk: '表面短时加热，中心未充分烫透者慎食' },
    { name: '🦆 鹅肠', time: 15, desc: '卷曲变脆即可', times: { rare: 10, medium: 15, wellDone: 25 }, cues: { rare: '肠身微弯、颜色转粉白', medium: '卷曲变脆、颜色粉白', wellDone: '卷紧发硬、明显缩水' }, risk: '短时涮烫中心可能未全熟' },
    { name: '🥩 吊龙', time: 15, desc: '（牛里脊）变色即可，勿久煮', times: { rare: 10, medium: 15, wellDone: 25 }, cues: { rare: '表面变粉、中心带血丝', medium: '完全变色无血色', wellDone: '颜色变深、开始发柴' }, risk: '偏生为中心带血丝的生熟状态' },
    { name: '🐑 羊肉卷', time: 30, desc: '卷曲变色无血色', times: { rare: 20, medium: 30, wellDone: 45 }, cues: { rare: '大部分变色、缝隙微带粉', medium: '卷曲变色、无血色', wellDone: '肉色深、边缘发硬' }, risk: '薄卷回沸慢时中心可能带粉' },
    { name: '🥩 牛肉卷', time: 30, desc: '变色即熟，不宜久煮', times: { rare: 20, medium: 30, wellDone: 45 }, cues: { rare: '变色八九成、留一丝粉', medium: '完全变色无血色', wellDone: '颜色发深、口感变柴' }, risk: '薄卷回沸慢时中心可能带粉' },
    { name: '👅 牛舌', time: 45, desc: '略微卷曲，颜色变浅', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '颜色变浅、略卷', medium: '略微卷曲、颜色均匀变浅', wellDone: '卷曲明显、边缘发硬' }, risk: '' },
    { name: '🥩 牛腩片', time: 45, desc: '肉质变紧，颜色均匀', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '变色大半、纹理微粉', medium: '肉质变紧、颜色均匀', wellDone: '明显收缩、口感发柴' }, risk: '' },
    { name: '💪 牛腱肉', time: 45, desc: '纹理清晰，略带嚼劲', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '表面变色、断面微粉', medium: '纹理清晰、断面同色', wellDone: '紧实难嚼' }, risk: '' },
    { name: '🐑 鲜切羊肉', time: 45, desc: '肉片变色，无血水', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '表面变色、贴骨处微粉', medium: '肉片变色、无血水', wellDone: '收缩发硬' }, risk: '鲜切比肉卷厚，偏生需确认无血水' },
    { name: '🫀 黄喉', time: 45, desc: '变白脆弹', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '开始变白', medium: '变白脆弹、边缘微卷', wellDone: '卷硬咬不动' }, risk: '' },
    { name: '🥩 鲜切牛肉', time: 45, desc: '血色褪去肉质紧', times: { rare: 35, medium: 45, wellDone: 60 }, cues: { rare: '表面变色、中心微红', medium: '血色褪去、肉质变紧', wellDone: '发柴塞牙' }, risk: '偏生为中心微红的生熟状态' },
    { name: '🥓 腊肉', time: 180, desc: '（若已蒸熟）烫热即可，（生）则需更久', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '热透、肥边变透明', medium: '吸味、肥边晶莹', wellDone: '更咸更韧' }, risk: '多为熟制品，生腊肉需煮更久' },
    { name: '🦴 牛筋', time: 180, desc: '变软糯，有弹性', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '变软有弹性', medium: '软糯带弹', wellDone: '软烂粘牙' }, risk: '' },
    { name: '🍖 酥肉', time: 180, desc: '（若已炸熟）吸饱汤汁，外皮略软', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '外皮微软', medium: '吸饱汤汁、外皮略软', wellDone: '完全软烂' }, risk: '多为炸熟制品' },
    { name: '🦆 鸭胗', time: 180, desc: '切花舒展，口感脆', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '切花初展开', medium: '切花舒展、口感脆', wellDone: '变硬发韧' }, risk: '内脏类，偏生未充分加热' },
    { name: '🐔 鸡胗', time: 180, desc: '切花舒展，口感爽脆', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '切花初展开', medium: '切花舒展、口感爽脆', wellDone: '变硬发韧' }, risk: '内脏类，偏生未充分加热' },
    { name: '🥚 鹌鹑蛋', time: 180, desc: '（熟）烫热即可，（生）蛋黄凝固', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '热透', medium: '蛋黄凝固', wellDone: '蛋白发韧' }, risk: '熟蛋烫热即可；生蛋需更久' },
    { name: '🐖 肥肠', time: 180, desc: '（若已卤熟）烫热入味', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '热透、开始入味', medium: '烫热入味', wellDone: '更软更入味' }, risk: '多为卤熟制品' },
    { name: '🌶️ 双椒牛肉', time: 180, desc: '辣椒颜色鲜亮不脱落', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '辣椒鲜亮、肉已变色', medium: '辣椒颜色鲜亮不脱落、肉全熟', wellDone: '辣椒软烂' }, risk: '裹浆较厚，中心需时更久' },
    { name: '📚 牛百叶', time: 180, desc: '叶片挺立，口感爽脆', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '叶片开始挺立', medium: '叶片挺立、口感爽脆', wellDone: '卷硬发韧' }, risk: '' },
    { name: '📚 千层肚', time: 15, desc: '叶片舒展变硬挺', times: { rare: 10, medium: 15, wellDone: 25 }, cues: { rare: '丝条微挺', medium: '叶片舒展变硬挺', wellDone: '卷紧发硬' }, risk: '表面短时加热，中心未充分烫透者慎食' },
  ],
  seafood: [
    { name: '🦪 生蚝', time: 60, desc: '蚝肉边缘卷曲，汁液变白', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '边缘微卷、汁液转白', medium: '边缘卷曲明显、汁液变白', wellDone: '收缩变硬' }, risk: '贝类，偏生有副溶血性弧菌风险' },
    { name: '🦐 虾', time: 60, desc: '（鲜虾）虾身弯曲变红', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '虾身开始变红弯曲', medium: '虾身弯曲成C形、通体变红', wellDone: '卷成O形、肉质发紧' }, risk: '甲壳类，偏生有副溶血性弧菌风险' },
    { name: '🦀 蟹', time: 240, desc: '（小/切块）蟹壳变红，肉质紧实', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '壳转橙红', medium: '蟹壳变红、肉质紧实', wellDone: '肉老离壳' }, risk: '蟹类务必煮透（肺吸虫/菌）' },
    { name: '🐚 扇贝', time: 240, desc: '贝肉变白，裙边卷曲', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '贝肉变白', medium: '贝肉变白、裙边卷曲', wellDone: '缩小变硬' }, risk: '贝类，偏生有副溶血性弧菌风险' },
    { name: '🐚 鲍鱼', time: 240, desc: '（小/切片）肉质收缩变弹', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '肉质收缩变弹', medium: '边缘卷起、肉质紧弹', wellDone: '橡皮口感' }, risk: '贝类，偏生有副溶血性弧菌风险' },
    { name: '🐟 鱼肚', time: 240, desc: '（鱼泡/鱼鳔）泡发后煮至软糯', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '变软', medium: '软糯吸汁', wellDone: '更软烂' }, risk: '' },
    { name: '🐚 花蛤', time: 240, desc: '贝壳完全张开', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '大部分开口', medium: '贝壳完全张开', wellDone: '肉缩小变硬' }, risk: '未开口的个别丢弃；贝类偏生有风险' },
    { name: '🦑 鱿鱼', time: 300, desc: '变半透明、微皱、有弹性即熟', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '开始变半透明', medium: '变半透明、微皱、有弹性', wellDone: '明显收缩发硬' }, risk: '头足类，未熟透易致消化不良' },
    { name: '🐍 鳝段', time: 360, desc: '肉质收缩无血丝，变紧实', times: { rare: 300, medium: 360, wellDone: 420 }, cues: { rare: '肉质收缩、贴骨处微红', medium: '肉质收缩无血丝、变紧实', wellDone: '肉离骨发硬' }, risk: '鳝鱼务必全熟（类组胺/寄生虫）' },
    { name: '🐸 牛蛙', time: 360, desc: '（腿/块）肉质变白，紧贴骨头', times: { rare: 300, medium: 360, wellDone: 420 }, cues: { rare: '肉变白、贴骨处微红', medium: '肉质变白、紧贴骨头', wellDone: '肉离骨发柴' }, risk: '蛙类务必全熟（裂头蚴风险）' },
  ],
  vegetable: [
    { name: '🌿 茼蒿', time: 60, desc: '茎秆微软香气浓', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '叶片变软', medium: '茎秆微软、香气浓', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🎍 莴笋', time: 60, desc: '片状断生，保持脆感', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '片状断生、保持脆感', medium: '半透明、脆嫩', wellDone: '软而不脆' }, risk: '无生食风险，按口感选档' },
    { name: '🥬 油麦菜', time: 60, desc: '叶片变软，颜色变深', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '叶片变软、颜色变深', medium: '叶软色深', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🥬 生菜', time: 60, desc: '叶片变软保持青绿', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '叶片变软保持青绿', medium: '变软转深绿', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🌱 韭菜', time: 60, desc: '颜色变深，微软即可', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '颜色变深', medium: '微软、色深', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🥬 娃娃菜', time: 120, desc: '菜帮变软不散', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '菜帮微软', medium: '菜帮变软、叶不散', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🥬 大白菜', time: 120, desc: '菜叶软塌，菜帮稍脆', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '菜叶软、菜帮稍脆', medium: '叶软塌、菜帮微软', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🌿 芝麻菜', time: 120, desc: '叶片萎蔫，特殊香气', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '叶片萎蔫', medium: '萎蔫、香气释放', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🌱 红薯苗', time: 120, desc: '（苕尖）叶片软塌，杆茎仍脆', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '叶片软塌、杆茎仍脆', medium: '叶软杆脆', wellDone: '全软' }, risk: '无生食风险，按口感选档' },
    { name: '🥦 花菜', time: 180, desc: '（西兰花/白菜花）颜色鲜艳，软硬适中', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '颜色鲜艳、稍硬', medium: '颜色鲜艳、软硬适中', wellDone: '软面' }, risk: '建议煮软些，利于消化' },
    { name: '🥒 丝瓜', time: 180, desc: '瓜肉变软透明', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '瓜肉开始变软', medium: '瓜肉变软透明', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🪷 藕片', time: 180, desc: '口感脆爽或粉糯', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '口感脆爽', medium: '脆中带面', wellDone: '粉糯' }, risk: '无生食风险，按口感选档' },
    { name: '🌊 海带', time: 180, desc: '（鲜/湿）叶片厚实不粘滑', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '厚实不粘滑', medium: '叶片厚实、口感弹', wellDone: '软糯' }, risk: '无生食风险，按口感选档' },
    { name: '🍄 木耳', time: 180, desc: '肉质肥厚发亮，口感爽脆', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '肥厚发亮', medium: '肉质肥厚发亮、爽脆', wellDone: '软韧' }, risk: '建议煮透' },
    { name: '🌱 海白菜', time: 180, desc: '叶片舒展，口感滑嫩', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '叶片舒展', medium: '舒展滑嫩', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🍠 山药', time: 180, desc: '断面呈粉质状，口感绵软', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '断面刚转粉', medium: '断面粉质、口感绵软', wellDone: '更面' }, risk: '务必断生，生黏液刺激口腔' },
    { name: '🥕 胡萝卜', time: 180, desc: '颜色更鲜艳，稍软但仍有脆度', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '颜色鲜艳、稍脆', medium: '稍软带脆', wellDone: '软面' }, risk: '无生食风险，按口感选档' },
    { name: '🎍 贡菜', time: 180, desc: '恢复鲜绿，口感爽脆', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '恢复鲜绿', medium: '鲜绿爽脆', wellDone: '软而不脆' }, risk: '无生食风险，按口感选档' },
    { name: '🍄 竹荪', time: 180, desc: '菌帽网状部分吸饱汤汁', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '开始吸汁', medium: '菌帽网状吸饱汤汁', wellDone: '软烂' }, risk: '' },
    { name: '🌼 黄花菜', time: 180, desc: '花蕾变软，颜色鲜黄', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '花蕾变软', medium: '变软、颜色鲜黄', wellDone: '软烂' }, risk: '干品需泡发；务必煮透' },
    { name: '🍄 杏鲍菇', time: 180, desc: '口感Q弹，吸汁', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '边缘开始变软', medium: '口感Q弹、吸汁', wellDone: '软嫩' }, risk: '建议煮透' },
    { name: '🍠 红薯', time: 240, desc: '块状需煮透，筷子可穿', times: { rare: 210, medium: 240, wellDone: 300 }, cues: { rare: '筷子可插入', medium: '筷子可穿透、中心绵', wellDone: '粉烂' }, risk: '块状需煮透' },
    { name: '🥔 土豆', time: 240, desc: '片/块边缘透明，中心绵软', times: { rare: 210, medium: 240, wellDone: 300 }, cues: { rare: '边缘透明、中心稍硬', medium: '边缘透明、中心绵软', wellDone: '散开' }, risk: '片/块均需煮透' },
    { name: '🎍 竹笋', time: 240, desc: '（大块）纤维软化不塞牙', times: { rare: 210, medium: 240, wellDone: 300 }, cues: { rare: '纤维稍软', medium: '纤维软化不塞牙', wellDone: '更软' }, risk: '务必煮透（草酸/氰苷）' },
    { name: '🌽 玉米', time: 240, desc: '（段）颗粒饱满，香甜', times: { rare: 210, medium: 240, wellDone: 300 }, cues: { rare: '颗粒饱满', medium: '饱满香甜', wellDone: '更甜软' }, risk: '无生食风险，按口感选档' },
    { name: '🍄 茶树菇', time: 300, desc: '纤维软化不塞牙，充分入味', times: { rare: 270, medium: 300, wellDone: 360 }, cues: { rare: '纤维稍软', medium: '软化不塞牙、入味', wellDone: '软烂' }, risk: '建议煮透' },
    { name: '🍄 香菇', time: 300, desc: '（鲜/干泡发）菌褶吸饱汤汁，菇伞变软', times: { rare: 270, medium: 300, wellDone: 360 }, cues: { rare: '菇伞开始变软', medium: '菌褶吸汁、菇伞变软', wellDone: '软烂' }, risk: '建议煮透' },
    { name: '🍄 平菇', time: 300, desc: '菌伞完全展开，边缘微软', times: { rare: 270, medium: 300, wellDone: 360 }, cues: { rare: '菌伞展开', medium: '完全展开、边缘微软', wellDone: '软烂' }, risk: '建议煮透' },
    { name: '🍄 金针菇', time: 180, desc: '菌帽分离易嚼，软化入味', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '菌帽分离', medium: '软化入味、易嚼', wellDone: '软烂' }, risk: '建议煮透' },
    { name: '🌱 海带苗', time: 60, desc: '变软变亮', times: { rare: 45, medium: 60, wellDone: 90 }, cues: { rare: '变软变亮', medium: '软亮滑嫩', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
  ],
  bean: [
    { name: '🫓 面筋泡', time: 30, desc: '吸饱汤汁，变软即可', times: { rare: 20, medium: 30, wellDone: 60 }, cues: { rare: '开始吸汁', medium: '吸饱汤汁、变软', wellDone: '更软' }, risk: '无生食风险，按口感选档' },
    { name: '🥠 油豆皮', time: 30, desc: '（薄）软化即可，易吸味', times: { rare: 20, medium: 30, wellDone: 60 }, cues: { rare: '软化', medium: '微软吸味', wellDone: '软烂' }, risk: '易吸味，久煮易散' },
    { name: '🥖 老油条', time: 120, desc: '（半软半脆）吸汁后微软即可', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '外层微软', medium: '半软半脆、吸汁', wellDone: '全软' }, risk: '无生食风险，按口感选档' },
    { name: '🧈 嫩豆腐', time: 120, desc: '小心易碎，烫热即可', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '烫热', medium: '整体热透', wellDone: '更入味' }, risk: '小心易碎' },
    { name: '🥠 千页豆腐', time: 120, desc: '略微膨胀，口感Q弹', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '略微膨胀', medium: '膨胀、口感Q弹', wellDone: '更软' }, risk: '无生食风险，按口感选档' },
    { name: '🥠 豆腐皮', time: 120, desc: '（干/鲜）软化吸汁', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '软化', medium: '软化吸汁', wellDone: '软烂' }, risk: '' },
    { name: '🥠 油炸腐竹', time: 120, desc: '吸饱汤汁，微软带韧', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '微软', medium: '吸汁、微软带韧', wellDone: '软烂' }, risk: '' },
    { name: '🍜 水晶粉丝', time: 120, desc: '变透明，柔软顺滑', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '开始变透明', medium: '变透明、柔软顺滑', wellDone: '过软易断' }, risk: '无生食风险，按口感选档' },
    { name: '🍜 土豆粉', time: 120, desc: '变透明，Q弹有嚼劲', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '半透明', medium: '变透明、Q弹有嚼劲', wellDone: '软糯' }, risk: '无生食风险，按口感选档' },
    { name: '🫓 苕皮', time: 180, desc: '（红薯粉皮）透明软糯', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '开始透明', medium: '透明软糯', wellDone: '过软' }, risk: '无生食风险，按口感选档' },
    { name: '🍜 宽粉', time: 180, desc: '晶莹剔透，口感Q弹', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '半透明', medium: '晶莹剔透、Q弹', wellDone: '软糯易夹断' }, risk: '无生食风险，按口感选档' },
    { name: '🧊 冻豆腐', time: 180, desc: '吸饱汤汁，蜂窝明显', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '开始吸汁', medium: '蜂窝明显、吸满汤', wellDone: '更软' }, risk: '' },
    { name: '🍜 龙须面', time: 300, desc: '面条柔软，无硬心', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '变软、微带硬心', medium: '柔软无硬心', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
    { name: '🍡 年糕', time: 300, desc: '软糯不粘牙', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '开始变软', medium: '软糯不粘牙', wellDone: '软塌' }, risk: '无生食风险，按口感选档' },
    { name: '🥠 腐竹', time: 300, desc: '（干泡发）软韧入味', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '变软', medium: '软韧入味', wellDone: '软烂' }, risk: '干品需泡发' },
    { name: '🍜 手工面', time: 300, desc: '面条熟透，劲道', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '变软、微带硬心', medium: '熟透劲道', wellDone: '软烂' }, risk: '无生食风险，按口感选档' },
  ],
  ball: [
    { name: '🍡 包心丸', time: 240, desc: '漂浮膨胀，内心熟透', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮膨胀', medium: '漂浮膨胀、内心热透', wellDone: '更紧实' }, risk: '包心类需确认内心热透' },
    { name: '🦐 虾丸', time: 240, desc: '漂浮变大，内部熟透', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮变大', medium: '漂浮变大、内部热透', wellDone: '更紧实' }, risk: '' },
    { name: '🐖 猪肉丸', time: 240, desc: '漂浮变色，按压有弹性', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮变色', medium: '漂浮变色、按压有弹性', wellDone: '更紧实' }, risk: '猪肉制品偏生未充分加热' },
    { name: '🍢 四喜丸', time: 240, desc: '体积变大，浮起熟透', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '体积变大', medium: '体积变大、浮起', wellDone: '更紧实' }, risk: '肉丸需确认内部热透' },
    { name: '🌿 香菜丸', time: 240, desc: '漂浮，香菜味浓郁', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮', medium: '漂浮、香菜味浓', wellDone: '更紧实' }, risk: '' },
    { name: '🦑 墨鱼丸', time: 240, desc: '漂浮变白，Q弹爽口', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮变白', medium: '漂浮变白、Q弹爽口', wellDone: '更紧实' }, risk: '' },
    { name: '🥩 潮州牛肉丸', time: 240, desc: '弹性十足，内部多汁', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮变大', medium: '弹性十足、内部多汁', wellDone: '更紧实' }, risk: '' },
    { name: '🍄 香菇贡丸', time: 240, desc: '漂浮，香菇可见', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮', medium: '漂浮、香菇可见', wellDone: '更紧实' }, risk: '' },
    { name: '💥 撒尿牛丸', time: 240, desc: '膨胀，小心烫嘴', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '膨胀', medium: '膨胀、爆汁', wellDone: '更紧实' }, risk: '小心烫嘴' },
    { name: '🐟 鱼丸', time: 240, desc: '漂浮变大，口感Q弹', times: { rare: 180, medium: 240, wellDone: 300 }, cues: { rare: '漂浮变大', medium: '漂浮变大、口感Q弹', wellDone: '更紧实' }, risk: '' },
    { name: '🥩 牛肉滑', time: 180, desc: '漂浮变色，紧实Q弹', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '漂浮、变色大半', medium: '漂浮变色、紧实Q弹', wellDone: '更紧实' }, risk: '厚团需确认中心无粉色' },
    { name: '🦑 墨鱼滑', time: 180, desc: '漂浮变白，紧实Q弹', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '漂浮变白', medium: '漂浮变白、紧实Q弹', wellDone: '更紧实' }, risk: '厚团需确认中心热透' },
    { name: '🦐 虾滑', time: 180, desc: '漂浮变红，紧实Q弹', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '漂浮、中心微带粉', medium: '漂浮变红、紧实Q弹', wellDone: '更紧实' }, risk: '偏生中心可能带粉' },
    { name: '🦀 蟹黄鱼滑', time: 180, desc: '漂浮变色，蟹黄点缀', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '漂浮、变色大半', medium: '漂浮变色、蟹黄点缀', wellDone: '更紧实' }, risk: '厚团需确认中心热透' },
  ],
  other: [
    { name: '🥓 培根', time: 120, desc: '边缘卷曲，油脂溢出', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '边缘开始卷曲', medium: '边缘卷曲、油脂溢出', wellDone: '更韧' }, risk: '腌制肉制品，建议全熟' },
    { name: '🍖 火腿', time: 120, desc: '（片状）烫热即可', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '烫热', medium: '热透、脂边透明', wellDone: '更韧' }, risk: '熟制品，烫热即可' },
    { name: '🥫 午餐肉', time: 120, desc: '边缘微焦更香', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '边缘微变', medium: '边缘微焦更香', wellDone: '更韧' }, risk: '熟制品，烫热即可' },
    { name: '🦀 蟹肉棒', time: 120, desc: '（蟹柳）散开变色', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '开始散开', medium: '散开变色', wellDone: '全散' }, risk: '制品需热透' },
    { name: '🍥 鱼豆腐', time: 120, desc: '膨胀变软，Q弹', times: { rare: 90, medium: 120, wellDone: 180 }, cues: { rare: '开始膨胀', medium: '膨胀变软、Q弹', wellDone: '更软' }, risk: '' },
    { name: '🌭 脆皮肠', time: 180, desc: '肠衣开裂，香气四溢', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '肠衣开始裂', medium: '肠衣开裂、香气四溢', wellDone: '更韧' }, risk: '肉灌制品务必热透' },
    { name: '🐟 乌鱼卷', time: 180, desc: '（非乌鱼片）变白卷曲', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '变白卷曲', medium: '完全变白卷曲', wellDone: '变硬' }, risk: '水产建议全熟' },
    { name: '🥩 坨坨牛肉', time: 180, desc: '（预制）肉块热透入味', times: { rare: 150, medium: 180, wellDone: 240 }, cues: { rare: '热透', medium: '肉块热透入味', wellDone: '更软' }, risk: '预制块状需热透中心' },
    { name: '🐟 巴沙鱼片', time: 300, desc: '鱼肉变白，完全熟透', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '变白、中心微透', medium: '鱼肉完全变白、易碎分瓣', wellDone: '更紧' }, risk: '水产务必全熟' },
    { name: '👅 鸭舌', time: 300, desc: '（鲜）表皮收缩起皱', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '表皮开始收缩', medium: '表皮收缩起皱', wellDone: '更韧' }, risk: '' },
    { name: '🐑 嫩羊肉', time: 300, desc: '（块状/厚片）内部无血色', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '内部微带粉', medium: '内部无血色', wellDone: '发柴' }, risk: '块/厚片务必全熟' },
    { name: '🍲 毛血旺', time: 300, desc: '（成品）整体烫热，食材入味', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '整体热透', medium: '整体烫热、入味', wellDone: '更老' }, risk: '成品复热，鸭血需热透' },
    { name: '🥟 虾饺', time: 300, desc: '外皮透明，馅料浮起', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '外皮开始透明', medium: '外皮透明、馅料浮起', wellDone: '皮塌' }, risk: '' },
    { name: '🦴 牛仔骨', time: 300, desc: '肉质离骨，酱香浓郁', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '开始离骨', medium: '肉质离骨、酱香浓郁', wellDone: '更烂' }, risk: '' },
    { name: '🐔 鸡翅尖', time: 300, desc: '皮肉软糯，易脱骨', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '皮肉开始软', medium: '皮肉软糯、易脱骨', wellDone: '更烂' }, risk: '禽类务必全熟' },
    { name: '🐖 猪蹄', time: 300, desc: '（预制）皮糯肉烂，热透', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '皮开始糯', medium: '皮糯肉烂、热透', wellDone: '更烂' }, risk: '预制需热透' },
    { name: '🥟 蛋饺', time: 300, desc: '蛋皮吸汁，内馅熟透', times: { rare: 240, medium: 300, wellDone: 360 }, cues: { rare: '蛋皮吸汁', medium: '蛋皮吸汁、内馅热透', wellDone: '皮散' }, risk: '' },
    { name: '🐔 鸡翅中', time: 480, desc: '骨肉易分离，完全熟透', times: { rare: 420, medium: 480, wellDone: 540 }, cues: { rare: '开始脱骨', medium: '骨肉易分离、完全熟透', wellDone: '更烂' }, risk: '禽类务必全熟' },
    { name: '🧠 脑花', time: 480, desc: '（猪脑花）无血丝呈固态，绵密', times: { rare: 420, medium: 480, wellDone: 540 }, cues: { rare: '中心呈固态、无血丝', medium: '无血丝呈固态、绵密', wellDone: '更实' }, risk: '务必全熟（寄生虫风险）' },
    { name: '🐔 无骨凤爪', time: 480, desc: '胶质软糯，晶莹剔透', times: { rare: 420, medium: 480, wellDone: 540 }, cues: { rare: '胶质开始软', medium: '胶质软糯、晶莹剔透', wellDone: '更烂' }, risk: '禽类务必全熟' },
    { name: '🦴 排骨', time: 480, desc: '（小块）肉质离骨，软烂入味', times: { rare: 420, medium: 480, wellDone: 540 }, cues: { rare: '开始离骨', medium: '肉质离骨、软烂入味', wellDone: '更烂' }, risk: '小块需全熟' },
  ],
};
