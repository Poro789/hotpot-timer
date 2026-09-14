/**
 * 一次性脚本：给 food_catalog.csv 追加 Technique/Overtime/Midpoint 三列。
 * 用法：node scripts/add-cols.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(root, 'data', 'food_catalog.csv');

// 按食材名（去 emoji 前缀）配置三字段
const DATA = {
  // technique: 涮煮手法提示
  毛肚: { technique: '七上八下，抖散快烫' },
  鹅肠: { technique: '筷子夹住上下提涮数次' },
  吊龙: { technique: '大火沸汤微涮' },
  黄喉: { technique: '煮至管体向内打卷' },
  猪黄喉: { technique: '煮至管体向内打卷' },
  牛黄喉: { technique: '煮至管体向内打卷' },
  腰片: { technique: '单片夹住浸入沸油快涮' },
  鸭血: { technique: '冷锅或小火慢煨', midpoint: 0.5 },
  麻辣牛肉: { technique: '中火翻滚煮透断生' },
  滑嫩牛肉: { technique: '浮起受热均匀即捞' },
  牛骨髓: { technique: '漏勺中小火慢煨', midpoint: 0.5 },
  猪天堂: { technique: '受热两端翘起成月牙形' },
  黑鱼片: { technique: '薄鱼片遇沸汤极速泛白' },
  乌鱼片: { technique: '薄鱼片遇沸汤极速泛白' },
  龙利鱼片: { technique: '白肉微浮起轻掐断即熟' },
  巴沙鱼片: { technique: '白肉微浮起轻掐断即熟' },
  耗儿鱼: { technique: '中火煮透至鱼骨脱离' },
  泥鳅: { technique: '中火彻底煮透' },
  带鱼段: { technique: '切忌猛火翻搅致碎' },
  黄辣丁: { technique: '小火煨煮至鱼鳍立起' },
  鳝段: { technique: '中火煮透至血色褪净' },
  牛蛙: { technique: '中大火彻底煮透', midpoint: 0.5 },
  虾: { technique: '虾身弯曲成C形即捞' },
  基围虾: { technique: '虾身弯曲成C形即捞' },
  黑虎虾: { technique: '虾身弯曲成C形即捞' },
  墨鱼仔: { technique: '圆肚胀鼓、触角内蜷成球' },
  八爪鱼: { technique: '爪子全部回缩成菊花球' },
  鱿鱼: { technique: '刀口深卷成麦穗形' },
  鱿鱼卷: { technique: '刀口深卷成麦穗形' },
  响铃卷: { technique: '沉入浓汤3秒打个滚即捞' },
  油豆泡: { technique: '漏勺压入汤中吸足红油' },
  面筋球: { technique: '筷子戳小洞压入沸油' },
  豌豆尖: { technique: '筷子一摁变深翠绿立刻起锅' },
  茼蒿: { technique: '中火处翻两下断生即捞' },
  西洋菜: { technique: '沸汤快捞，变绿即食' },
  海带苗: { technique: '入沸汤变翠绿色即起' },
  海带芽: { technique: '入沸汤变翠绿色即起' },
  脑花: { technique: '漏勺中小火慢煨', midpoint: 0.5 },
  鸡爪: { technique: '开锅即下、久煨慢煮' },
  猪蹄: { technique: '中火浸煮至胶质黏嘴' },
  排骨: { technique: '深煮至筷子能扎透骨肉' },
  鸭掌: { technique: '沸汤透热后胶质化开' },
  无骨凤爪: { technique: '沸汤透热后胶质化开' },
  甜香肠: { technique: '肠体两头爆裂开花即捞' },
  脆皮肠: { technique: '肠衣开裂、香气四溢' },
  午餐肉: { technique: '表面浮起、边缘微胀' },
  蟹肉棒: { technique: '丝纹微散微浮即出锅' },
  鱼籽福袋: { technique: '外层豆皮变软膨大、内部滚烫' },
  芝士年糕: { technique: '浮于汤面按压有回弹' },
  年糕: { technique: '浮于汤面按压有回弹' },
  牛肉丸: { technique: '完全膨胀浮起、轻按有弹性' },
  猪肉丸: { technique: '漂浮变色、按压有弹性' },
  潮州牛肉丸: { technique: '完全浮起并膨胀变大一圈' },
  虾滑: { technique: '勺挖成球下锅，完全浮起即捞' },
  墨鱼滑: { technique: '滑团浮起、由暗灰变挺实' },
  牛肉滑: { technique: '浮起受热均匀、表面滑嫩' },
  金针菇卷: { technique: '牛肉变熟同时金针菇熟透' },
  鸭心: { technique: '花刀完全张开呈球状' },
  鸡肾: { technique: '煮透至球体鼓圆、蛋白凝固' },
  鸭肾: { technique: '煮透至球体鼓圆、蛋白凝固' },
  牛肚仁: { technique: '变白挺起即可，久煮发韧' },
  猪肚丝: { technique: '变白卷曲微挺即熟' },
  牛脆管: { technique: '白管微缩变硬' },
  猪鼻筋: { technique: '半透筋膜缩紧发白卷曲' },
  鸭掌筋: { technique: '筋条遇热缩成透亮硬挺' },
  匙柄: { technique: '中间细肉筋微缩受热变白' },
  牛胸口油: { technique: '脂肪受热紧缩打卷' },
  香菜牛肉: { technique: '外层变灰断生、内部香菜带生脆' },
  泡椒牛肉: { technique: '牛肉全熟包裹酸辣泡椒' },
  双椒牛肉: { technique: '全熟变色即可捞起' },
  折耳根: { technique: '根部30~60秒脆且味浓' },
  贡菜: { technique: '变深翠绿且微透即捞' },
  竹荪: { technique: '几经翻滚、吸饱汤汁变软' },
  冻豆腐: { technique: '蜂窝孔洞充盈汤水、手感饱满' },
  豆腐皮: { technique: '下锅软化吸汤即起' },
  油豆皮: { technique: '下锅软化吸汤即起' },
  豆黄金: { technique: '滚汤内数秒打软吸汁即捞' },
  腐竹: { technique: '捏压无坚硬内芯、表皮软滑' },
  油炸腐竹: { technique: '捏压无坚硬内芯、表皮软滑' },
  宽粉: { technique: '煮至通体透明无白芯' },
  土豆粉: { technique: '白条变莹白半透、浮于汤面' },
  苕皮: { technique: '变深色透明凝胶状、轻晃软弹' },
  魔芋丝: { technique: '多滚少许吸纳牛油辣味' },
  老油条: { technique: '轻蘸快起，依口味调整' },
  白萝卜: { technique: '吃完荤菜后下锅，吸油解腻' },
  冬瓜: { technique: '瓜肉边缘完全透明软化' },
  藕片: { technique: '断生微透即保持脆甜' },
  土豆: { technique: '薄片通透即捞，厚片多煮' },
  竹笋: { technique: '笋肉纤维稍煮透、涩味尽褪' },
  羊肚菌: { technique: '菌腔吸饱汤汁膨软' },
  绣球菌: { technique: '花瓣由白微透即捞' },
  香菇: { technique: '菇盖发软多汁即可' },
  平菇: { technique: '完全煮软、压出生水' },
  杏鲍菇: { technique: '切片煮透转软' },
  金针菇: { technique: '菇体由挺立转为完全伏软' },
  木耳: { technique: '表面光滑油亮、耳瓣伸展' },
  娃娃菜: { technique: '中火少浮油处烫，防过辣' },
  海带: { technique: '叶片厚实不粘滑' },
  山药: { technique: '断面呈粉质状、口感绵软' },
  胡萝卜: { technique: '颜色更鲜艳、稍软带脆' },
  红薯: { technique: '块状需煮透、筷子可穿' },
  玉米: { technique: '段状颗粒饱满、香甜' },
  花菜: { technique: '颜色鲜艳、软硬适中' },
  丝瓜: { technique: '瓜肉变软透明' },
  油麦菜: { technique: '叶片变软、颜色变深' },
  生菜: { technique: '叶片变软保持青绿' },
  韭菜: { technique: '颜色变深、微软即可' },
  大白菜: { technique: '菜叶软塌、菜帮稍脆' },
  芝麻菜: { technique: '叶片萎蔫、特殊香气' },
  红薯苗: { technique: '叶片软塌、杆茎仍脆' },
  海白菜: { technique: '叶片舒展、口感滑嫩' },
  黄花菜: { technique: '花蕾变软、颜色鲜黄' },
  茶树菇: { technique: '纤维软化不塞牙、充分入味' },
  莴笋: { technique: '青绿半透明为清脆断生' },
  牛筋: { technique: '煮至半透明琥珀色、软糯拉丝' },
  酥肉: { technique: '吸饱汤汁、外皮略软' },
  腊肉: { technique: '烫热即可、肥边变透明' },
  肥肠: { technique: '煮至肠壁软糯出油' },
  鸭胗: { technique: '十字花刀翻卷绽开' },
  鸡胗: { technique: '薄切片受热打卷发硬' },
  鹌鹑蛋: { technique: '熟蛋入锅透热即可' },
  牛百叶: { technique: '叶片舒展、稍有卷翘发紧' },
  千层肚: { technique: '百叶丝叶片舒展、稍有卷翘' },
  牛舌: { technique: '极薄快涮、遇热微缩打卷' },
  牛舌片: { technique: '极薄快涮、遇热微缩打卷' },
  乌鸡卷: { technique: '薄切刨卷、完全变色舒展' },
  羊肉卷: { technique: '肉片泛白散开、脆骨发硬' },
  牛肉卷: { technique: '沸腾处展开快涮' },
  鲜切牛肉: { technique: '血色褪去、肉质变紧' },
  鲜切羊肉: { technique: '肉片变色、无血水' },
  牛腩片: { technique: '肉质变紧、颜色均匀' },
  牛腱肉: { technique: '纹理清晰、略带嚼劲' },
  嫩羊肉: { technique: '内部无血色' },
  牛仔骨: { technique: '肉质离骨、酱香浓郁' },
  鸡翅尖: { technique: '皮肉软糯、易脱骨' },
  鸡翅中: { technique: '骨肉易分离、完全熟透' },
  坨坨牛肉: { technique: '肉块热透入味' },
  毛血旺: { technique: '整体烫热、食材入味' },
  虾饺: { technique: '外皮透明、馅料浮起' },
  蛋饺: { technique: '蛋皮吸汁、内馅熟透' },
  鱼豆腐: { technique: '膨胀变软、Q弹' },
  鱼肚: { technique: '泡发后煮至软糯' },
  生蚝: { technique: '蚝肉边缘卷曲、汁液变白' },
  蟹: { technique: '蟹壳变红、肉质紧实' },
  扇贝: { technique: '贝肉变白、裙边卷曲' },
  鲍鱼: { technique: '肉质收缩变弹' },
  花蛤: { technique: '贝壳完全张开' },
  培根: { technique: '边缘卷曲、油脂溢出' },
  火腿: { technique: '烫热即可、脂边透明' },
  乌鱼卷: { technique: '变白卷曲' },
  鸭舌: { technique: '舌尖受热外翻、舌根紧致' },
  包心丸: { technique: '漂浮膨胀、内心熟透' },
  虾丸: { technique: '漂浮变大、内部熟透' },
  四喜丸: { technique: '体积变大、浮起熟透' },
  香菜丸: { technique: '漂浮、香菜味浓郁' },
  墨鱼丸: { technique: '漂浮变白、Q弹爽口' },
  香菇贡丸: { technique: '漂浮、香菇可见' },
  撒尿牛丸: { technique: '膨胀、小心烫嘴' },
  鱼丸: { technique: '漂浮变大、口感Q弹' },
  蟹黄鱼滑: { technique: '漂浮变色、蟹黄点缀' },
  面筋泡: { technique: '吸饱汤汁、变软即可' },
  嫩豆腐: { technique: '小心易碎、烫热即可' },
  千页豆腐: { technique: '略微膨胀、口感Q弹' },
  水晶粉丝: { technique: '变透明、柔软顺滑' },
  龙须面: { technique: '面条柔软、无硬心' },
  手工面: { technique: '面条熟透、劲道' },
};

// overtime: hard=多煮即老 / soft=多煮更入味
const OVERTIME = {
  // hard: 涮烫类，多煮即老
  毛肚: 'hard', 鹅肠: 'hard', 吊龙: 'hard', 千层肚: 'hard', 牛百叶: 'hard',
  牛舌: 'hard', 牛舌片: 'hard', 乌鸡卷: 'hard', 匙柄: 'hard', 黑鱼片: 'hard',
  乌鱼片: 'hard', 龙利鱼片: 'hard', 巴沙鱼片: 'hard', 响铃卷: 'hard',
  豆黄金: 'hard', 豌豆尖: 'hard', 茼蒿: 'hard', 西洋菜: 'hard',
  海带苗: 'hard', 海带芽: 'hard', 牛肚仁: 'hard', 猪肚丝: 'hard',
  牛脆管: 'hard', 猪鼻筋: 'hard', 鸭掌筋: 'hard', 贡菜: 'hard',
  竹荪: 'hard', 油豆皮: 'hard', 豆腐皮: 'hard', 老油条: 'hard',
  蟹肉棒: 'hard', 绣球菌: 'hard', 金针菇: 'hard', 木耳: 'hard',
  娃娃菜: 'hard', 生菜: 'hard', 油麦菜: 'hard', 韭菜: 'hard',
  莴笋: 'hard', 冬瓜: 'hard', 藕片: 'hard', 土豆: 'hard',
  虾: 'hard', 基围虾: 'hard', 黑虎虾: 'hard', 墨鱼仔: 'hard',
  八爪鱼: 'hard', 鱿鱼: 'hard', 鱿鱼卷: 'hard', 耗儿鱼: 'hard',
  泥鳅: 'hard', 带鱼段: 'hard', 黄辣丁: 'hard', 鳝段: 'hard',
  牛蛙: 'hard', 鸭心: 'hard', 鸡肾: 'hard', 鸭肾: 'hard',
  鸭胗: 'hard', 鸡胗: 'hard', 香菜牛肉: 'hard', 泡椒牛肉: 'hard',
  双椒牛肉: 'hard', 滑嫩牛肉: 'hard', 麻辣牛肉: 'hard',
  牛肉卷: 'hard', 羊肉卷: 'hard', 鲜切牛肉: 'hard', 鲜切羊肉: 'hard',
  肥肠: 'hard', 牛筋: 'hard', 猪天堂: 'hard', 牛胸口油: 'hard',
  甜香肠: 'hard', 脆皮肠: 'hard', 午餐肉: 'hard', 鸭舌: 'hard',
  虾滑: 'hard', 墨鱼滑: 'hard', 牛肉滑: 'hard', 金针菇卷: 'hard',
  面筋球: 'hard', 油豆泡: 'hard', 鱼籽福袋: 'hard', 芝士年糕: 'hard',
  年糕: 'hard', 宽粉: 'hard', 土豆粉: 'hard', 苕皮: 'hard',
  魔芋丝: 'hard', 冻豆腐: 'hard', 腐竹: 'hard', 油炸腐竹: 'hard',
  白萝卜: 'hard', 竹笋: 'hard', 羊肚菌: 'hard', 香菇: 'hard',
  平菇: 'hard', 杏鲍菇: 'hard', 茶树菇: 'hard', 黄花菜: 'hard',
  山药: 'hard', 胡萝卜: 'hard', 红薯: 'hard', 玉米: 'hard',
  花菜: 'hard', 丝瓜: 'hard', 大白菜: 'hard', 芝麻菜: 'hard',
  红薯苗: 'hard', 海白菜: 'hard', 海带: 'hard', 嫩豆腐: 'hard',
  千页豆腐: 'hard', 水晶粉丝: 'hard', 龙须面: 'hard', 手工面: 'hard',
  面筋泡: 'hard', 生蚝: 'hard', 蟹: 'hard', 扇贝: 'hard',
  鲍鱼: 'hard', 花蛤: 'hard', 鱼肚: 'hard', 培根: 'hard',
  火腿: 'hard', 乌鱼卷: 'hard', 坨坨牛肉: 'hard', 毛血旺: 'hard',
  虾饺: 'hard', 蛋饺: 'hard', 鱼豆腐: 'hard', 包心丸: 'hard',
  虾丸: 'hard', 四喜丸: 'hard', 香菜丸: 'hard', 墨鱼丸: 'hard',
  香菇贡丸: 'hard', 撒尿牛丸: 'hard', 鱼丸: 'hard', 蟹黄鱼滑: 'hard',
  牛肉丸: 'hard', 猪肉丸: 'hard', 潮州牛肉丸: 'hard',
  牛腩片: 'hard', 牛腱肉: 'hard', 嫩羊肉: 'hard', 牛仔骨: 'hard',
  鸡翅尖: 'hard', 鸡翅中: 'hard', 腊肉: 'hard', 酥肉: 'hard',
  鹌鹑蛋: 'hard', 鸭掌: 'hard', 无骨凤爪: 'hard', 猪蹄: 'hard',
  排骨: 'hard', 鸡爪: 'hard', 脑花: 'hard', 鸭血: 'hard',
  腰片: 'hard', 黄喉: 'hard', 猪黄喉: 'hard', 牛黄喉: 'hard',
  牛骨髓: 'hard',
};

// midpoint: 阶段提示（0~1）——仅冷锅/慢煨类食材需要中途检查
const MIDPOINT = {
  鸭血: 0.5,      // 完全浮起
  脑花: 0.5,      // 浮出汤面
  牛蛙: 0.5,      // 肉质变白
  牛骨髓: 0.5,    // 乳白凝固
  鸡爪: 0.5,      // 外皮开始软
  猪蹄: 0.5,      // 皮开始糯
  排骨: 0.5,      // 开始离骨
  耗儿鱼: 0.5,    // 鱼肉开始收缩
  泥鳅: 0.5,      // 鱼肉开始紧缩
  鳝段: 0.5,      // 肉质开始收缩
  黄辣丁: 0.5,    // 鱼鳍开始立起
  带鱼段: 0.5,    // 银鳞开始收
  宽粉: 0.5,      // 开始变透明
  土豆粉: 0.5,    // 开始变半透
  苕皮: 0.5,      // 开始透明
  冻豆腐: 0.5,    // 开始吸汁
  腐竹: 0.5,      // 开始变软
  油炸腐竹: 0.5,  // 开始微软
  白萝卜: 0.5,    // 边缘开始透明
  冬瓜: 0.5,      // 瓜肉开始变软
  藕片: 0.5,      // 开始断生
  土豆: 0.5,      // 边缘开始透明
  竹笋: 0.5,      // 纤维开始软
  羊肚菌: 0.5,    // 菌腔开始吸汁
  香菇: 0.5,      // 菇伞开始变软
  平菇: 0.5,      // 菌伞开始展开
  杏鲍菇: 0.5,    // 边缘开始变软
  金针菇: 0.5,    // 菌帽开始分离
  木耳: 0.5,      // 开始肥厚发亮
  山药: 0.5,      // 断面开始转粉
  红薯: 0.5,      // 筷子可插入
  茶树菇: 0.5,    // 纤维开始软
  黄花菜: 0.5,    // 花蕾开始变软
  海带: 0.5,      // 开始厚实
  丝瓜: 0.5,      // 瓜肉开始变软
  胡萝卜: 0.5,    // 颜色开始鲜艳
  玉米: 0.5,      // 颗粒开始饱满
  花菜: 0.5,      // 颜色开始鲜艳
  大白菜: 0.5,    // 菜叶开始软
  娃娃菜: 0.5,    // 菜帮开始微软
  生蚝: 0.5,      // 边缘开始微卷
  蟹: 0.5,        // 壳开始转橙红
  扇贝: 0.5,      // 贝肉开始变白
  鲍鱼: 0.5,      // 肉质开始收缩
  花蛤: 0.5,      // 大部分开口
  鱼肚: 0.5,      // 开始变软
  虾: 0.5,        // 虾身开始变红
  基围虾: 0.5,    // 虾身开始变红
  黑虎虾: 0.5,    // 虾身开始变红
  墨鱼仔: 0.5,    // 圆肚开始胀
  八爪鱼: 0.5,    // 头部开始圆鼓
  鱿鱼: 0.5,      // 开始变半透明
  鱿鱼卷: 0.5,    // 开始卷曲
};

// 解析 CSV
const text = readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '');
const lines = text.split('\n').filter((l) => l.trim() !== '');
const header = lines[0];
const newHeader = header + ',Technique,Overtime,Midpoint';

const outLines = [newHeader];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // 提取第一列（Name）
  const match = line.match(/^"([^"]+)"/);
  if (!match) {
    outLines.push(line + ',,,');
    continue;
  }
  const fullName = match[1];
  // 去 emoji 前缀：取最后一个空格后的部分
  const parts = fullName.split(' ');
  const shortName = parts[parts.length - 1];

  const d = DATA[shortName] || {};
  const technique = d.technique || '';
  const overtime = OVERTIME[shortName] || '';
  const midpoint = MIDPOINT[shortName] !== undefined ? String(MIDPOINT[shortName]) : '';

  outLines.push(line + `,${technique},${overtime},${midpoint}`);
}

writeFileSync(CSV, outLines.join('\n'), 'utf8');
console.log(`✓ 已追加三列，共 ${outLines.length - 1} 行数据`);