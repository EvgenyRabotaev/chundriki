#!/usr/bin/env python3
"""tools/mascot_lines.json -> js/mascot-lines.js (запасной пул) и seed-миграция."""
import json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
d = json.load(open(R/'tools/mascot_lines.json', encoding='utf-8'))
(R/'js/mascot-lines.js').write_text('// Запасной пул шуток маскота (генерируется tools/gen_mascot.py). Основной — таблица mascot_lines.\nexport const FALLBACK = ' + json.dumps(d, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
q = lambda s: "'" + s.replace("'", "''") + "'"
rows = [f"({q(t)},'general',null,null)" for t in d['general']]
for slug, ts in d['badge'].items():
    rows += [f"({q(t)},'badge',{q(slug)},null)" for t in ts]
rows += [f"({q(t)},'member',null,null)" for t in d['member']['hello']]
for p, ts in d['page'].items():
    rows += [f"({q(t)},'page',null,{q(p)})" for t in ts]
sql = "-- Черновой пул шуток маскота. Применять только после согласования текстов.\ninsert into public.mascot_lines (text, kind, badge_id, page)\nselect v.t, v.k, (select id from public.badges b where b.slug = v.s), v.p\nfrom (values\n" + ",\n".join(rows).replace(",'general',null,null)", ",'general',null::text,null::text)") + "\n) as v(t,k,s,p);\n"
(R/'supabase/migrations/20261121_mascot_seed.sql').write_text(sql, encoding='utf-8')
