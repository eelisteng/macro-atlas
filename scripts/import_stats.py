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
      utils/seed-data.js（随包种子）
"""
import http.cookiejar
import json
import os
import re
import urllib.request

BASE = 'https://data.stats.gov.cn/dg/website/publicrelease/web/external'
HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://data.stats.gov.cn/dg/website/page.html',
    'X-Requested-With': 'XMLHttpRequest',
}
ANNUAL_ROOT = '884c062607104a91967b22742537f44f'
MONTH_ROOT = 'fc982599aa684be7969d7b90b1bd0e84'
QUARTER_ROOT = 'a94b8b7365a94874968cabbe392cf679'
NATION = [{'text': '全国', 'value': '000000000000'}]
SOURCE = '国家统计局'
SOURCE_URL = 'https://data.stats.gov.cn'
BATCH = 'stats-20261111-trade'

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# 国家数据站点有 WAF（JSESSIONID + wzws_cid）。裸 urlopen 会 302 无限重定向，
# 必须用同一个 opener 携带 cookie 会话，首个 GET 完成挑战后后续请求才能正常返回。
_COOKIE_JAR = http.cookiejar.CookieJar()
_OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_COOKIE_JAR))


def get(path):
    req = urllib.request.Request(BASE + path, headers=HEADERS)
    with _OPENER.open(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))


def post(path, body):
    headers = dict(HEADERS)
    headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode('utf-8'),
                                 headers=headers, method='POST')
    with _OPENER.open(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))


def warmup():
    """建立 WAF cookie 会话；失败会在后续请求中自然暴露，不静默吞掉。"""
    get('/new/queryIndexTreeAsync?pid=&code=1')


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


# 货物进出口目录的原始单位为千美元；1 亿美元 = 100000 千美元。
# 只对金额类 key 换算，同比类保持原值，绝不把换算施加到百分比上。
SCALE_BY_KEY = {
    'tt': 100000.0,  # 进出口总值当月
    'el': 100000.0,  # 出口总值当月
    'il': 100000.0,  # 进口总值当月
    'tb': 100000.0,  # 贸易差额当月
}


def collect(cid, indicator_ids, dts, root, freq, mapping, transform=None):
    """返回 [(key, period, value)]；空值一律跳过，绝不补零或插值。"""
    result = es_data(cid, list(indicator_ids), dts, root)
    out = []
    for row in result.get('data', []):
        period = period_of(row.get('code', ''), freq)
        if not period:
            continue
        for v in row.get('values', []):
            iid = v.get('_id')
            raw = v.get('value')
            if iid not in mapping or raw is None or raw == '':
                continue
            try:
                number = float(raw)
            except (TypeError, ValueError):
                continue
            key = mapping[iid]
            number = number / SCALE_BY_KEY.get(key, 1.0)
            if transform:
                number = transform(number)
            out.append((key, period, str(round(number, 4))))
    return out


# code -> 紧凑 key / 频率 / 单位 / 口径。key 与 STATIC_SERIES / CPI_SEGMENTS 的映射一一对应。
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
    # 第二批：补 6 个原缺口
    ('q', 'gdp_yoy_cn_quarter', 'year', '%', '同比 / 实际（剔除价格） / 年度 / 由国内生产总值指数换算（指数-100）'),
    ('h', 'core_cpi_yoy_cn_month', 'month', '%', '同比 / 剔除食品和能源 / 由上年同月=100 指数换算（指数-100） / 2021 年起'),
    ('v', 'ppi_yoy_cn_month', 'month', '%', '同比 / 工业生产者出厂价格 / 由上年同月=100 指数换算（指数-100）'),
    ('o', 'population_cn_year', 'year', '万人', '年末存量 / 全国'),
    ('f', 'fiscal_revenue_cn_year', 'year', '亿元', '年度累计 / 名义 / 统计汇编口径'),
    ('x', 'exports_yoy_cn_month', 'month', '%', '同比 / 美元计价 / 海关口径 / 由国家统计局国家数据转载'),
    # 第二批：新增 4 个维度
    ('r', 'retail_sales_yoy_cn_month', 'month', '%', '同比 / 当月 / 名义'),
    ('j', 'industrial_va_yoy_cn_month', 'month', '%', '同比 / 当月 / 实际（剔除价格）'),
    ('a', 'fai_yoy_cn_month', 'month', '%', '累计同比 / 年初至当月 / 不含农户'),
    ('e', 'real_estate_invest_yoy_cn_month', 'month', '%', '累计同比 / 年初至当月'),
    # 第三批：货物进出口全套（同一 TRADE_CID 目录，8 个字段一次取回）
    ('tt', 'trade_total_cn_month', 'month', '亿美元', '当月值 / 美元计价 / 海关口径 / 货物贸易'),
    ('el', 'exports_level_cn_month', 'month', '亿美元', '当月值 / 美元计价 / 海关口径'),
    ('il', 'imports_level_cn_month', 'month', '亿美元', '当月值 / 美元计价 / 海关口径'),
    ('tb', 'trade_balance_cn_month', 'month', '亿美元', '当月值 / 美元计价 / 出口减进口 / 可为负'),
    ('ty', 'trade_total_yoy_cn_month', 'month', '%', '当月同比 / 美元计价 / 海关口径'),
    ('iy', 'imports_yoy_cn_month', 'month', '%', '当月同比 / 美元计价 / 海关口径'),
    ('tk', 'trade_total_cum_yoy_cn_month', 'month', '%', '累计同比 / 年初至当月 / 美元计价'),
]

GDP_CID = 'f7fd25aaad184414875632cf2327da60'
PMI_CID = '93ffbb1aa85740d3aa2618371508b606'
MONEY_CID = '82130c6621a745cda3d64b090e733383'
JOB_CID = 'ee3b7046b390415b9b7745e3d16f6052'
# 第二批新增目录（均来自国家统计局「国家数据」公开接口，2026-11-11 实测）
GDPQ_CID = 'f9b694c9b79e4ce5958bc88c6410fa67'      # 季度数据 / 国内生产总值指数
PPI_CID = '60e8b361f11c4a878c652a6487a25561'       # 月度 / 工业生产者出厂价格指数
POP_CID = '6331ad868e8b4f55b8e9b6e765609ce1'       # 年度 / 总人口
FISCAL_CID = '9ab4eeaba2264792b296b6658b6472dc'    # 年度 / 一般公共预算收支
TRADE_CID = '7e11b47c828d4e4e925f1c5a98305558'     # 月度 / 货物进出口总额
RETAIL_CID = 'd0cb882c7f27443ab6b3ef9421901961'    # 月度 / 社会消费品零售总额
INDUSTRY_CID = '3f2e14f0542348ed9fe02476eca3450b'  # 月度 / 规上工业增加值增长速度
FAI_CID = '5129067b149d4ddfbec1ffc478d35bfb'       # 月度 / 固定资产投资概况
ESTATE_CID = '9206137ccf03460daa74b7799e0f3c31'    # 月度 / 房地产开发投资情况

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
# 指数类（上年同月/上年同期=100）统一减 100 换算成同比，绝不编造或插值。
GDPQ_IIDS = {'170e7f00f8c24ede863c0526b42ae81f': 'q'}
PPI_IIDS = {'150633e52b9a470a9a9fd1b296dd6c5b': 'v'}
POP_IIDS = {'806083491dbe46a08995783945a30b9d': 'o'}
FISCAL_IIDS = {'47768ef2d84343468356fcaf26fef62f': 'f'}
# 货物进出口目录共 14 个字段，这里取读者最常用的 8 个：4 个当月金额 + 3 个同比 + 出口同比。
# 累计金额与累计增长和当月值高度重复，未纳入，避免同义词条淹没列表。
TRADE_IIDS = {
    '6770f815eded431a93bf422d38ab488c': 'tt',  # 进出口总值当期值（千美元）
    '5143e29f77ee4d3489eaf46b901ba610': 'ty',  # 进出口总值同比增长（%）
    '15c2012323b14adea523f1b9300bb609': 'tk',  # 进出口总值累计增长（%）
    '9e38b39f55a7461ea195508c1bb7dbdc': 'el',  # 出口总值当期值（千美元）
    '788f44b0f310403fbd308b77d6f83890': 'x',   # 出口总值同比增长（%）
    '86a340fee806409ebdf4d0069bd23f29': 'il',  # 进口总值当期值（千美元）
    'cc1ac699bc4f4cd7aa5c2b7a1e643259': 'iy',  # 进口总值同比增长（%）
    '0123bdd4e85348f28efc74685a4a40e5': 'tb',  # 进出口差额当期值（千美元）
}
RETAIL_IIDS = {'aaac57d54d2e465d91bc9f3ea1a8618e': 'r'}
INDUSTRY_IIDS = {'ef1b1765960d45a29b4d7c4ca91be916': 'j'}
FAI_IIDS = {'7e570cf8071c4734a7d78d9f0a70fbe1': 'a'}
ESTATE_IIDS = {'205e08cba8c2409980db58c98da91b6f': 'e'}

# (cid, 指标映射, 期间范围, 根, 频率, 换算)。季度目录在 YYYY 格式下返回年度 GDP 指数，
# 接口不提供可用的季度 dts，因此按年度实际同比落地（详见 utils/indicators.js 注释）。
INDEX_MINUS_100 = lambda v: v - 100.0
STATIC_SERIES = [
    (GDP_CID, GDP_IIDS, '2000YY-2025YY', ANNUAL_ROOT, 'year', None),
    (PMI_CID, PMI_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (MONEY_CID, MONEY_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (JOB_CID, JOB_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (GDPQ_CID, GDPQ_IIDS, '1993YY-2026YY', QUARTER_ROOT, 'year', INDEX_MINUS_100),
    (PPI_CID, PPI_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', INDEX_MINUS_100),
    (POP_CID, POP_IIDS, '2000YY-2025YY', ANNUAL_ROOT, 'year', None),
    (FISCAL_CID, FISCAL_IIDS, '2000YY-2025YY', ANNUAL_ROOT, 'year', None),
    (TRADE_CID, TRADE_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (RETAIL_CID, RETAIL_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (INDUSTRY_CID, INDUSTRY_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (FAI_CID, FAI_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
    (ESTATE_CID, ESTATE_IIDS, '202101MM-202610MM', MONTH_ROOT, 'month', None),
]

# CPI 按 5 年分片，指标 id 每段都不同：必须逐段取再拼接，否则历史会静默截断。
# 「不包括食品和能源」分项只在 2021 年起的两段提供，早期段留空，不用其他分项冒充。
CPI_SEGMENTS = [
    ('954cfd7597e34b919ec71caf6aeead51', '200001MM-201512MM'),
    ('9d4eec43537742a7ab5d63db97fa2f51', '201601MM-202012MM'),
    ('809d2522b0fe4be89142650341b19083', '202101MM-202512MM'),
    ('5c7452825c7c4dcba391db5ca7f335c5', '202601MM-202610MM'),
]


def cpi_indicators(cid):
    """返回 (指标 id 列表, id->key 映射)：主 CPI 为 i，核心 CPI 为 h。"""
    data = get('/new/queryIndicatorsByCid?cid=' + cid)
    mapping = {}
    for item in data.get('data', {}).get('list', []):
        name = item.get('i_showname', '')
        iid = item.get('_id')
        if not iid:
            continue
        if name.startswith('居民消费价格指数'):
            mapping[iid] = 'i'
        elif '不包括食品和能源' in name:
            mapping[iid] = 'h'
    return list(mapping.keys()), mapping


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


NOTE = (
    '第一批 12 序列 + 第二批 10 序列（GDP 实际同比、核心 CPI、PPI、年末总人口、'
    '一般公共预算收入、出口同比、社零、规上工业、固投、房地产投资）'
    '+ 第三批货物进出口 7 序列（进出口/出口/进口/差额当月值、进出口与进口同比、进出口累计同比）；'
    '进出口目录原始单位为千美元，金额类统一除以 100000 换算为亿美元，同比类不换算；'
    '指数类由上年同月/上年同期=100 换算为同比；CPI 按 5 年分片逐段拼接，核心 CPI 仅 2021 年起提供；'
    '季度 dts 不可用，GDP 实际同比按年度粒度落库；空值不入图、不插值；'
    '转载须注明转自国家统计局网站 www.stats.gov.cn'
)


def main():
    warmup()
    rows = []
    for cid, iids, dts, root, freq, transform in STATIC_SERIES:
        rows += collect(cid, iids.keys(), dts, root, freq, iids, transform)
    for cid, dts in CPI_SEGMENTS:
        iids, mapping = cpi_indicators(cid)
        if not iids:
            print('WARN: CPI segment has no indicator:', cid)
            continue
        rows += collect(cid, iids, dts, MONTH_ROOT, 'month', mapping,
                        transform=INDEX_MINUS_100)

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
        # 字典字段随代码同步更新；冲突键含 frequency，改频率前需先把云端旧行改一致。
        + " ON CONFLICT (code, region, frequency) DO UPDATE SET "
        + "name=EXCLUDED.name, alias=EXCLUDED.alias, category=EXCLUDED.category, "
        + "unit=EXCLUDED.unit, value_type=EXCLUDED.value_type, caliber=EXCLUDED.caliber, "
        + "default_chart=EXCLUDED.default_chart, source_name=EXCLUDED.source_name, "
        + "source_url=EXCLUDED.source_url, comparable_group=EXCLUDED.comparable_group, "
        + "importance=EXCLUDED.importance, sort_order=EXCLUDED.sort_order"
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
        "ON CONFLICT (indicator_id, period, revision) DO UPDATE SET "
        "value=EXCLUDED.value, unit=EXCLUDED.unit, caliber=EXCLUDED.caliber, "
        "import_batch=EXCLUDED.import_batch, updated_at=now()"
    )

    point_count = len(compact)
    indicator_count = len(set(k for k, _, _ in compact))
    sync_sql = (
        "INSERT INTO sync_logs (source,indicator_count,inserted_count,updated_count,failed_count,note) VALUES "
        "('国家统计局 · 国家数据 API', %d, %d, 0, 0, '%s')"
        % (indicator_count, point_count, esc(NOTE))
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
        'note': NOTE,
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
