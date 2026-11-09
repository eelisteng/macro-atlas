#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宏观图鉴 · 会话侧批量取数脚本。

小程序不直连外部 API（受 request 合法域名与备案限制）。本脚本在本机会话中运行，
从国家统计局「国家数据」公开接口取数，生成三条 SQL：
  1) indicators  指标字典（与 utils/indicators.js 同源）
  2) data_points 真实历史序列
  3) sync_logs   本次同步记录
生成的 SQL 由云数据库管理工具执行，产物落在 app 自己的云数据库里。

用法：python3 scripts/import_stats.py
输出：scripts/seed_indicators.sql / scripts/seed_points.sql / scripts/seed_sync.sql
"""
import json
import os
import re
import urllib.request

BASE = 'https://data.stats.gov.cn/dg/website/publicrelease/web/external'
HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://data.stats.gov.cn/dg/website/page.html',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
}
ANNUAL_ROOT = '884c062607104a91967b22742537f44f'
MONTH_ROOT = 'fc982599aa684be7969d7b90b1bd0e84'
NATION = [{'text': '全国', 'value': '000000000000'}]
SOURCE = '国家统计局'
SOURCE_URL = 'https://data.stats.gov.cn'
BATCH = 'stats-20261107'

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def get(path):
    req = urllib.request.Request(BASE + path, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))


def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode('utf-8'),
                                 headers=HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def es_data(cid, indicator_ids, dts, root):
    body = {
        'cid': cid, 'indicatorIds': indicator_ids,
        'das': NATION, 'daCatalogId': '', 'dts': [dts],
        'showType': '1', 'rootId': root,
    }
    return post('/stream/esData', body)


def period_of(code, freq):
    if freq == 'year':
        m = re.match(r'^(\d{4})YY$', code)
        return m.group(1) if m else None
    m = re.match(r'^(\d{4})(\d{2})MM$', code)
    return m.group(1) + '-' + m.group(2) if m else None


def collect(cid, indicator_ids, dts, root, freq, mapping, transform=None):
    """返回 [(key, period, value)]；空字符串一律跳过，绝不补零或插值。"""
    result = es_data(cid, list(indicator_ids), dts, root)
    out = []
    for row in result.get('data', []):
        period = period_of(row.get('code', ''), freq)
        if not period:
            continue
        for v in row.get('values', []):
            iid = v.get('_id')
            if iid not in mapping or not v.get('value'):
                continue
            try:
                number = float(v.get('value'))
            except (TypeError, ValueError):
                continue
            if transform:
                number = transform(number)
            out.append((mapping[iid], period, str(round(number, 4))))
    return out


# code -> 紧凑 key / 频率 / 单位 / 口径
SPEC = [
    ('g', 'gdp_nominal_cn_year', 'year', '亿元', '当期值 / 名义'),
    ('n', 'gni_cn_year', 'year', '亿元', '当期值 / 名义'),
    ('p', 'va_primary_cn_year', 'year', '亿元', '当期值 / 名义'),
    ('s', 'va_secondary_cn_year', 'year', '亿元', '当期值 / 名义'),
    ('t', 'va_tertiary_cn_year', 'year', '亿元', '当期值 / 名义'),
    ('c', 'gdp_per_capita_cn_year', 'year', '元', '当期值 / 名义 / 按年平均人口'),
    ('i', 'cpi_yoy_cn_month', 'month', '%', '同比 / 由上年同月=100 指数换算（指数-100）'),
    ('m', 'pmi_manufacturing_cn_month', 'month', '%', '扩散指数 / 统计局口径'),
    ('2', 'm2_yoy_cn_month', 'month', '%', '同比 / 期末值计算'),
    ('1', 'm1_yoy_cn_month', 'month', '%', '同比 / 期末值计算'),
    ('b', 'm2_level_cn_month', 'month', '亿元', '期末值 / 存量'),
    ('u', 'unemployment_cn_month', 'month', '%', '比率 / 全国城镇 / 调查口径'),
]

GDP_CID = 'f7fd25aaad184414875632cf2327da60'
PMI_CID = '93ffbb1aa85740d3aa2618371508b606'
MONEY_CID = '82130c6621a745cda3d64b090e733383'
JOB_CID = 'ee3b7046b390415b9b7745e3d16f6052'

GDP_IIDS = {
    '661e37455bd5458196f00842e965d6ce': 'n',
    '7dc6a2ee6c614960b7059991e0cc4d96': 'g',
    'fb00df5cde1c41509e681eff1c10f387': 'p',
    '95f6ceb2e6d147da83c3c5ad6a2e8bde': 's',
    '30966f1491de4744b6e21b76867e983f': 't',
    'eb4d93f19d57495c89f98875e03e01be': 'c',
}
MONEY_IIDS = {
    'e03f2232631f41cd9d754a7d7feb4a81': '2',
    '640401d3351b4b868dea28f89f410a54': '1',
    'f3c0ae453a54424489af41de315ec592': 'b',
}
JOB_IIDS = {'3888eac6062945a79c8a27e5f13d4953': 'u'}
PMI_IIDS = {'a09aa989bdcf4cffa2021795722eb916': 'm'}

# CPI 按 5 年分片，指标 id 每段都不同：必须逐段取再拼接，否则历史会静默截断。
CPI_SEGMENTS = [
    ('954cfd7597e34b919ec71caf6aeead51', '200001MM-201512MM'),
    ('9d4eec43537742a7ab5d63db97fa2f51', '201601MM-202012MM'),
    ('809d2522b0fe4be89142650341b19083', '202101MM-202512MM'),
    ('5c7452825c7c4dcba391db5ca7f335c5', '202601MM-202610MM'),
]


def cpi_indicators(cid):
    data = get('/new/queryIndicatorsByCid?cid=' + cid)
    for item in data.get('data', {}).get('list', []):
        name = item.get('i_showname', '')
        if name.startswith('居民消费价格指数'):
            return [item.get('_id')], {item.get('_id'): 'i'}
    return [], {}


def load_indicator_catalog():
    """从 utils/indicators.js 读取指标字典，避免维护两份定义。"""
    path = os.path.join(ROOT, 'utils', 'indicators.js')
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    items = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('{ code:'):
            continue
        strings = dict(re.findall(r"(\w+): '([^']*)'", line))
        numbers = dict((k, int(v)) for k, v in re.findall(r'(\w+): (\d+)', line))
        if 'code' not in strings:
            continue
        items.append({
            'code': strings.get('code', ''),
            'name': strings.get('name', ''),
            'alias': strings.get('alias', ''),
            'category': strings.get('category', ''),
            'region': strings.get('region', 'CN'),
            'unit': strings.get('unit', ''),
            'frequency': strings.get('frequency', 'year'),
            'value_type': strings.get('value_type', 'level'),
            'caliber': strings.get('caliber', ''),
            'default_chart': strings.get('default_chart', 'line'),
            'source_name': strings.get('source_name', SOURCE),
            'source_url': strings.get('source_url', SOURCE_URL),
            'comparable_group': strings.get('comparable_group', ''),
            'importance': numbers.get('importance', 2),
            'sort_order': numbers.get('sort_order', 0),
        })
    return items


def esc(value):
    return str(value).replace("'", "''")


def main():
    rows = []
    rows += collect(GDP_CID, GDP_IIDS.keys(), '2000YY-2025YY', ANNUAL_ROOT, 'year', GDP_IIDS)
    rows += collect(PMI_CID, PMI_IIDS.keys(), '202101MM-202610MM', MONTH_ROOT, 'month', PMI_IIDS)
    rows += collect(MONEY_CID, MONEY_IIDS.keys(), '202101MM-202610MM', MONTH_ROOT, 'month', MONEY_IIDS)
    rows += collect(JOB_CID, JOB_IIDS.keys(), '202101MM-202610MM', MONTH_ROOT, 'month', JOB_IIDS)
    for cid, dts in CPI_SEGMENTS:
        iids, mapping = cpi_indicators(cid)
        if not iids:
            print('WARN: CPI segment has no indicator:', cid)
            continue
        rows += collect(cid, iids, dts, MONTH_ROOT, 'month', mapping,
                        transform=lambda v: v - 100.0)

    # 去重：同一 key+period 只留最后一个（后段覆盖前段）。
    dedup = {}
    for key, period, value in rows:
        dedup[(key, period)] = value
    compact = [[k, p, v] for (k, p), v in sorted(dedup.items())]

    catalog = load_indicator_catalog()
    values = []
    for item in catalog:
        values.append("('%s','%s','%s','%s','%s','%s','%s','%s','%s','%s','%s','%s','%s',%d,%d,false)" % (
            esc(item['code']), esc(item['name']), esc(item['alias']), esc(item['category']),
            esc(item['region']), esc(item['unit']), esc(item['frequency']), esc(item['value_type']),
            esc(item['caliber']), esc(item['default_chart']), esc(item['source_name']),
            esc(item['source_url']), esc(item['comparable_group']),
            item['importance'], item['sort_order'],
        ))
    indicators_sql = (
        "INSERT INTO indicators (code,name,alias,category,region,unit,frequency,value_type,caliber,default_chart,source_name,source_url,comparable_group,importance,sort_order,is_custom) VALUES "
        + ','.join(values)
        + " ON CONFLICT (code, region, frequency) DO NOTHING"
    )

    spec_values = ','.join(
        "('%s','%s','%s','%s','%s')" % (k, esc(code), freq, esc(unit), esc(caliber))
        for k, code, freq, unit, caliber in SPEC
    )
    points_sql = (
        "WITH spec(k,code,freq,unit,caliber) AS (VALUES " + spec_values + "), "
        "raw(k,period,value) AS (SELECT a.arr->>0, a.arr->>1, a.arr->>2 FROM jsonb_array_elements('"
        + json.dumps(compact, ensure_ascii=False, separators=(',', ':')).replace("'", "''")
        + "'::jsonb) AS a(arr)) "
        "INSERT INTO data_points (indicator_id,period,period_type,value,unit,caliber,source,source_url,release_date,revision,is_latest,import_batch,auto_imported) "
        "SELECT i.id, raw.period, spec.freq, (raw.value)::numeric, spec.unit, spec.caliber, '"
        + SOURCE + "', '" + SOURCE_URL + "', '', 'final', true, '" + BATCH + "', true "
        "FROM raw JOIN spec ON spec.k = raw.k JOIN indicators i ON i.code = spec.code "
        "ON CONFLICT (indicator_id, period, revision) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"
    )

    point_count = len(compact)
    indicator_count = len(set(k for k, _, _ in compact))
    sync_sql = (
        "INSERT INTO sync_logs (source,indicator_count,inserted_count,updated_count,failed_count,note) VALUES "
        "('国家统计局 · 国家数据 API', %d, %d, 0, 0, "
        "'年度 GDP 六组序列与月度 CPI/PMI/M2/M1/失业率；CPI 由上年同月=100 指数换算为同比；分片逐段拼接；空值不入图；转载须注明转自国家统计局网站 www.stats.gov.cn')"
        % (indicator_count, point_count)
    )

    for name, sql in [('seed_indicators.sql', indicators_sql),
                      ('seed_points.sql', points_sql),
                      ('seed_sync.sql', sync_sql)]:
        with open(os.path.join(HERE, name), 'w', encoding='utf-8') as f:
            f.write(sql)
        print(name, len(sql), 'chars')

    # 随包种子数据：由小程序在首次启动或「同步内置数据」时写入自己的云数据库。
    # 取数仍在会话侧完成，小程序不直连任何外部接口。
    seed_payload = {
        'batch': BATCH,
        'source': SOURCE,
        'sourceUrl': SOURCE_URL,
        'note': 'CPI 由上年同月=100 指数换算为同比；CPI 分片逐段拼接；空值不入图；转载须注明转自国家统计局网站 www.stats.gov.cn',
        'indicators': catalog,
        'spec': [{'k': k, 'code': code, 'freq': freq, 'unit': unit, 'caliber': caliber}
                 for k, code, freq, unit, caliber in SPEC],
        'rows': compact,
    }
    seed_path = os.path.join(ROOT, 'utils', 'seed-data.js')
    with open(seed_path, 'w', encoding='utf-8') as f:
        f.write('// 由 scripts/import_stats.py 自动生成，请勿手工编辑。\n')
        f.write('// 数据来源：国家统计局「国家数据」公开接口；取数批次 ' + BATCH + '。\n')
        f.write('// 数值均来自一手来源，不含估算值；小程序首次启动时写入自己的云数据库。\n')
        f.write('module.exports = ')
        f.write(json.dumps(seed_payload, ensure_ascii=False, separators=(',', ':')))
        f.write(';\n')
    print('utils/seed-data.js', os.path.getsize(seed_path), 'bytes')

    print('indicators:', len(catalog), '| data points:', point_count,
          '| series:', indicator_count)
    per = {}
    for k, _, _ in compact:
        per[k] = per.get(k, 0) + 1
    print('per series:', json.dumps(per, ensure_ascii=False))


if __name__ == '__main__':
    main()
