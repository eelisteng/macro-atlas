// 指标字典（本地随包副本）：专题、释义、口径与可比分组。
// 数据库 indicators 表是 id 与可管理元数据的来源；本文件提供即时渲染所需的说明文案。
// 两边以 code 对齐。数据点一律来自云数据库 data_points，不在本地存放任何数值。

var STATS = {
    name: '国家统计局',
    url: 'https://data.stats.gov.cn',
    cite: '转自国家统计局网站 www.stats.gov.cn',
};

var TOPICS = [
    {
        key: 'growth', name: '增长', subtitle: '经济总量与景气',
        description: '看经济整体在变大还是变小：总量看规模，同比看速度，PMI 看当月景气。',
    },
    {
        key: 'prices', name: '物价', subtitle: '通胀与价格',
        description: 'CPI 反映居民端价格，PPI 反映工业端价格。同比比环比更适合看长期趋势。',
    },
    {
        key: 'money', name: '货币信贷', subtitle: '流动性与利率',
        description: 'M1/M2 看货币供给快慢，社融与利率看信用扩张的成本和力度。',
    },
    {
        key: 'labor', name: '就业外贸', subtitle: '就业与外部需求',
        description: '就业是滞后指标，出口与外汇储备反映外部需求和跨境资金状况。',
    },
    {
        key: 'fiscal', name: '财政人口', subtitle: '财政与长期变量',
        description: '年度频率为主，适合放在十年以上的尺度里看结构变化。',
    },
];

// comparable_group 是「口径 + 单位」签名。不同分组默认禁止叠加，避免跨口径误读。
var INDICATORS = [
    // 增长
    { code: 'gdp_nominal_cn_year', name: '国内生产总值', alias: 'GDP 总量 名义GDP', category: 'growth', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义 / 不变价口径不适用', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '一个国家或地区在一年内生产的全部最终产品和服务的价值，是衡量经济规模最常用的总量指标。', how_to_read: '看总量规模，也要结合人口看人均；比较增速时应改用「实际同比」，名义值包含价格变化。', related: '人均国内生产总值 / GDP 实际同比', comparable_group: 'cny_level', importance: 3, sort_order: 10 },
    { code: 'gni_cn_year', name: '国民总收入', alias: 'GNI 国民收入', category: 'growth', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '本国居民在国内外取得的初次收入总和，与 GDP 的差别在于跨境要素收入。', how_to_read: '与 GDP 放在同一张图看差距，通常两者走势接近。', related: '国内生产总值', comparable_group: 'cny_level', importance: 1, sort_order: 11 },
    { code: 'va_primary_cn_year', name: '第一产业增加值', alias: '农业增加值', category: 'growth', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义', default_chart: 'stack', source_name: STATS.name, source_url: STATS.url, explainer: '农林牧渔业创造的附加值，是三次产业构成中的第一产业。', how_to_read: '与二、三产业一起看结构占比，单看总量意义有限。', related: '第二产业增加值 / 第三产业增加值', comparable_group: 'cny_level', importance: 1, sort_order: 12 },
    { code: 'va_secondary_cn_year', name: '第二产业增加值', alias: '工业与建筑业增加值', category: 'growth', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义', default_chart: 'stack', source_name: STATS.name, source_url: STATS.url, explainer: '工业和建筑业创造的附加值，反映制造与投资活动的规模。', how_to_read: '看它在 GDP 中的占比变化，可以观察经济结构转型。', related: '第一产业增加值 / 第三产业增加值', comparable_group: 'cny_level', importance: 2, sort_order: 13 },
    { code: 'va_tertiary_cn_year', name: '第三产业增加值', alias: '服务业增加值', category: 'growth', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义', default_chart: 'stack', source_name: STATS.name, source_url: STATS.url, explainer: '服务业创造的附加值，是当前经济中占比最大的部分。', how_to_read: '占比持续上升通常意味着经济向服务化转型。', related: '第二产业增加值', comparable_group: 'cny_level', importance: 2, sort_order: 14 },
    { code: 'gdp_per_capita_cn_year', name: '人均国内生产总值', alias: '人均GDP', category: 'growth', region: 'CN', unit: '元', frequency: 'year', value_type: 'level', caliber: '当期值 / 名义 / 按年平均人口', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: 'GDP 除以常住人口，用来比较不同规模经济体的平均产出水平。', how_to_read: '跨国比较时要换算成同一币种，并注意名义与实际口径差别。', related: '国内生产总值 / 年末总人口', comparable_group: 'cny_per_capita', importance: 2, sort_order: 15 },
    { code: 'gdp_yoy_cn_quarter', name: 'GDP 实际同比', alias: 'GDP增速 经济增长率', category: 'growth', region: 'CN', unit: '%', frequency: 'quarter', value_type: 'growth', caliber: '同比 / 实际（剔除价格） / 当季', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '本季实际 GDP 相对上年同季的增长百分比，已剔除价格因素。', how_to_read: '中国常发布同比；美国常发布环比折年率，两者不能直接连线比较。', related: '美国 GDP 环比折年率', comparable_group: 'pct_yoy', importance: 3, sort_order: 16, gapReason: '季度同比序列尚未完成口径核对，等待下一批灌库。' },
    { code: 'pmi_manufacturing_cn_month', name: '制造业 PMI', alias: '采购经理指数 景气指数', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'index', caliber: '扩散指数 / 未季调口径以统计局为准', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '对制造业采购经理的月度问卷调查汇总成的扩散指数，反映当月景气变化方向。', how_to_read: '通常高于 50 表示较上月扩张，低于 50 表示收缩；看方向比看绝对值更重要。', related: '工业增加值 / 出口金额同比', comparable_group: 'index_point', importance: 3, sort_order: 17 },

    // 物价
    { code: 'cpi_yoy_cn_month', name: 'CPI 同比', alias: '居民消费价格 通胀', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 由上年同月=100 指数换算（指数-100）', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '居民消费价格指数相对上年同月的变动百分比，是衡量居民端通胀最常用的指标。', how_to_read: '统计局原始序列为「上年同月=100」指数，本表已换算为同比；连续数月同向变化比单月数值更有意义。', related: '核心 CPI 同比 / PPI 同比', comparable_group: 'pct_yoy', importance: 3, sort_order: 20 },
    { code: 'core_cpi_yoy_cn_month', name: '核心 CPI 同比', alias: '核心通胀', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 剔除食品和能源', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '剔除食品和能源后的居民消费价格同比，用于观察更稳定的价格趋势。', how_to_read: '与 CPI 同比的差值主要来自食品和能源的短期波动。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 21, gapReason: '核心 CPI 需从分项指数单独取数，等待下一批灌库。' },
    { code: 'ppi_yoy_cn_month', name: 'PPI 同比', alias: '工业生产者出厂价格', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 工业生产者出厂价格', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '工业产品第一次出售时价格相对上年同月的变动，反映工业端价格压力。', how_to_read: 'PPI 向 CPI 的传导并不总是成立，需结合需求端一起看。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 22, gapReason: 'PPI 分行业表结构较复杂，等待下一批灌库。' },
    { code: 'cpi_yoy_us_month', name: '美国 CPI 同比', alias: 'US CPI', category: 'prices', region: 'US', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 需注明季调或未季调', default_chart: 'line', source_name: '美国劳工统计局 (BLS)', source_url: 'https://www.bls.gov/cpi/', explainer: '美国城市消费者价格指数相对上年同月的变化。', how_to_read: '中美 CPI 的篮子权重与季调处理不同，跨地区只能比趋势方向，不能直接比高低。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 23, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },

    // 货币信贷
    { code: 'm2_yoy_cn_month', name: 'M2 同比', alias: '广义货币 货币供应量', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 期末值计算', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '广义货币供应量（货币和准货币）相对上年同月的增速，反映流动性宽裕程度。', how_to_read: '增速高低要结合名义 GDP 增速一起看，单看货币增速容易误判。', related: 'M1 同比 / 社融存量', comparable_group: 'pct_yoy', importance: 3, sort_order: 30 },
    { code: 'm1_yoy_cn_month', name: 'M1 同比', alias: '狭义货币', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 期末值计算', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '狭义货币供应量相对上年同月的增速，更多反映企业活期资金与经济活跃度。', how_to_read: 'M1 与 M2 增速的剪刀差常被用来观察资金是否「活化」，但口径曾调整，跨期比较需留意。', related: 'M2 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 31 },
    { code: 'm2_level_cn_month', name: 'M2 期末余额', alias: 'M2余额', category: 'money', region: 'CN', unit: '亿元', frequency: 'month', value_type: 'level', caliber: '期末值 / 存量', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '广义货币供应量的月末存量。', how_to_read: '存量适合看规模，同比适合看变化速度，两者不要混在同一张图。', related: 'M2 同比', comparable_group: 'cny_level', importance: 1, sort_order: 32 },
    { code: 'social_financing_cn_month', name: '社会融资规模存量', alias: '社融存量', category: 'money', region: 'CN', unit: '万亿元', frequency: 'month', value_type: 'level', caliber: '存量 / 期末值', default_chart: 'line', source_name: '中国人民银行', source_url: 'http://www.pbc.gov.cn/', explainer: '实体经济从金融体系获得的资金存量，覆盖贷款、债券、股票融资等。', how_to_read: '人民银行以公告和表格发布，本表仅保留可追溯的人工录入值。', related: 'M2 同比 / LPR', comparable_group: 'cny_trillion', importance: 2, sort_order: 33, gapReason: '人民银行未提供 JSON 接口，等待人工核对后录入。' },
    { code: 'lpr_1y_cn_month', name: '1 年期 LPR', alias: '贷款市场报价利率', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'rate', caliber: '利率 / 月末报价', default_chart: 'line', source_name: '全国银行间同业拆借中心', source_url: 'https://www.chinamoney.com.cn/', explainer: '贷款市场报价利率，是银行贷款定价的主要参考。', how_to_read: '属于利率水平而非增速，不能用「涨跌颜色」表达同比含义。', related: '10 年期国债收益率', comparable_group: 'pct_rate', importance: 2, sort_order: 34, gapReason: '需人工核对每月报价发布时间，等待录入。' },

    // 就业外贸
    { code: 'unemployment_cn_month', name: '城镇调查失业率', alias: '失业率 调查失业率', category: 'labor', region: 'CN', unit: '%', frequency: 'month', value_type: 'rate', caliber: '比率 / 全国城镇 / 调查口径', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '通过劳动力抽样调查得到的城镇失业人口占劳动力的比例。', how_to_read: '属于比率而非增速；青年等分项口径曾调整，跨期比较前先看口径说明。', related: 'PMI / 出口金额同比', comparable_group: 'pct_rate', importance: 3, sort_order: 40 },
    { code: 'exports_yoy_cn_month', name: '出口金额同比', alias: '出口增速', category: 'labor', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 美元计价需另行注明', default_chart: 'bar', source_name: '海关总署', source_url: 'http://www.customs.gov.cn/', explainer: '当月出口金额相对上年同月的变化，反映外部需求强弱。', how_to_read: '注意计价币种与是否剔除基数效应；与 PMI 新出口订单一起看更稳。', related: '制造业 PMI', comparable_group: 'pct_yoy', importance: 2, sort_order: 41, gapReason: '海关总署未提供结构化接口，等待人工核对后录入。' },
    { code: 'fx_reserve_cn_month', name: '外汇储备', alias: '外储', category: 'labor', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '期末值 / 存量', default_chart: 'line', source_name: '国家外汇管理局', source_url: 'https://www.safe.gov.cn/', explainer: '央行持有的对外金融资产储备月末余额。', how_to_read: '存量变动同时受估值与汇率影响，不等于资本净流入。', related: '出口金额同比', comparable_group: 'usd_100m', importance: 1, sort_order: 42, gapReason: '需人工核对后录入。' },

    // 财政人口
    { code: 'population_cn_year', name: '年末总人口', alias: '总人口 人口', category: 'fiscal', region: 'CN', unit: '万人', frequency: 'year', value_type: 'level', caliber: '年末存量 / 全国', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '每年年末的全国总人口，是长期结构分析的基础变量。', how_to_read: '年度频率，适合与人均 GDP、劳动力相关指标一起看。', related: '人均国内生产总值', comparable_group: 'wan_people', importance: 3, sort_order: 50, gapReason: '年度人口分表尚未完成取数，等待下一批灌库。' },
    { code: 'fiscal_revenue_cn_year', name: '一般公共预算收入', alias: '财政收入', category: 'fiscal', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '年度累计 / 名义', default_chart: 'bar', source_name: '财政部', source_url: 'http://www.mof.gov.cn/', explainer: '一般公共预算的年度收入合计，反映政府可支配财力。', how_to_read: '与支出一起看收支缺口；注意年度决算与预算执行数的差别。', related: '一般公共预算支出', comparable_group: 'cny_level', importance: 2, sort_order: 51, gapReason: '财政部以公告和表格发布，等待人工核对后录入。' },
    { code: 'gdp_yoy_us_quarter', name: '美国 GDP 环比折年率', alias: 'US GDP annualized', category: 'growth', region: 'US', unit: '%', frequency: 'quarter', value_type: 'growth', caliber: '环比折年率 / 季调 / 实际', default_chart: 'bar', source_name: '美国经济分析局 (BEA)', source_url: 'https://www.bea.gov/', explainer: '把当季相对上季的环比增速外推成全年增速，是美国季度 GDP 的常见发布口径。', how_to_read: '会放大当季波动，与中国发布的同比不是同一口径，不能直接连线比较。', related: 'GDP 实际同比', comparable_group: 'pct_qoq_annualized', importance: 2, sort_order: 18, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },
    { code: 'gdp_yoy_eu_quarter', name: '欧元区 GDP 同比', alias: 'EU GDP', category: 'growth', region: 'EU', unit: '%', frequency: 'quarter', value_type: 'growth', caliber: '同比 / 季调 / 实际', default_chart: 'line', source_name: '欧盟统计局 (Eurostat)', source_url: 'https://ec.europa.eu/eurostat', explainer: '欧元区实际 GDP 相对上年同季的变化。', how_to_read: '季调处理与中国口径不同，跨地区只宜比较趋势方向。', related: 'GDP 实际同比', comparable_group: 'pct_yoy', importance: 1, sort_order: 19, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },
];

var REGION_NAMES = { CN: '中国', US: '美国', EU: '欧元区' };
var FREQUENCY_NAMES = { year: '年度', quarter: '季度', month: '月度' };

function findIndicator(code) {
    for (var i = 0; i < INDICATORS.length; i += 1) {
        if (INDICATORS[i].code === code) return INDICATORS[i];
    }
    return null;
}

function topicByKey(key) {
    for (var i = 0; i < TOPICS.length; i += 1) {
        if (TOPICS[i].key === key) return TOPICS[i];
    }
    return null;
}

function indicatorsByCategory(category) {
    return INDICATORS.filter(function (item) { return item.category === category; });
}

function searchIndicators(keyword) {
    var k = String(keyword || '').trim().toLowerCase();
    if (!k) return INDICATORS;
    return INDICATORS.filter(function (item) {
        return (item.name + ' ' + item.alias + ' ' + item.code + ' ' + item.category).toLowerCase().indexOf(k) >= 0;
    });
}

module.exports = {
    TOPICS: TOPICS,
    INDICATORS: INDICATORS,
    REGION_NAMES: REGION_NAMES,
    FREQUENCY_NAMES: FREQUENCY_NAMES,
    SOURCE_CITE: STATS.cite,
    findIndicator: findIndicator,
    topicByKey: topicByKey,
    indicatorsByCategory: indicatorsByCategory,
    searchIndicators: searchIndicators,
};
