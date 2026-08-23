import csv

category_mapping = {
    '肉类': 'meat',
    '海鲜类': 'seafood',
    '蔬菜类': 'vegetable',
    '豆制品类': 'bean',
    '丸滑类': 'ball',
    '经典火锅菜': 'other'
}

categories = {}
with open('hotpot_food_library (1).csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        cat_key = category_mapping.get(row['Category'])
        if not cat_key:
            continue
        if cat_key not in categories:
            categories[cat_key] = []
        categories[cat_key].append({
            'name': row['Name'],
            'time': int(row['Time']),
            'desc': row['ServingTip']
        })

js = '// 食材数据库（从CSV导入）\nconst foodDatabase = {\n'
for cat in sorted(categories.keys()):
    js += f'    {cat}: [\n'
    for food in categories[cat]:
        # 处理特殊字符
        name = food['name'].replace("'", "\\'")
        desc = food['desc'].replace("'", "\\'")
        js += f'        {{ name: \'{name}\', time: {food["time"]}, desc: \'{desc}\' }},\n'
    js += '    ],\n'
js += '};'

with open('foodDatabase.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('已生成 foodDatabase.js')
