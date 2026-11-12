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
        description: '看经济整体在变大还是变小：总量看规模，同比看速度，PMI 看当月景气，社零与投资看内需和地产。',
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
        key: 'labor', name: '就业', subtitle: '就业与劳动力',
        description: '就业是滞后指标，城镇调查失业率反映劳动力市场的松紧程度。进出口、出口与外汇储备等外部部门指标已移至「对外贸易」专题，可点上方标签切换。',
    },
    {
        key: 'trade', name: '对外贸易', subtitle: '进出口与外部需求',
        description: '海关口径的月度货物贸易：当月金额看规模、同比看冷热、差额看顺差；统一按美元计价，注意基数效应与春节错月扰动。',
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
    // 历史 code 含 quarter 是初版命名；国家数据接口的季度粒度不可取，实际落库为年度实际同比，code 保持不变以兼容云端主键。
    { code: 'gdp_yoy_cn_quarter', name: 'GDP 实际同比', alias: 'GDP增速 经济增长率', category: 'growth', region: 'CN', unit: '%', frequency: 'year', value_type: 'growth', caliber: '同比 / 实际（剔除价格） / 年度 / 由国内生产总值指数换算（指数-100）', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '本年实际 GDP 相对上年的增长百分比，已剔除价格因素，与名义 GDP 总量不是同一口径。', how_to_read: '看增长速度应改用本指标，不要把名义总量的涨幅当成实际增速；美国常发布环比折年率，两者不能直接连线比较。', related: '美国 GDP 环比折年率 / 国内生产总值', comparable_group: 'pct_yoy', importance: 3, sort_order: 16 },
    { code: 'pmi_manufacturing_cn_month', name: '制造业 PMI', alias: '采购经理指数 景气指数', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'index', caliber: '扩散指数 / 未季调口径以统计局为准', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '对制造业采购经理的月度问卷调查汇总成的扩散指数，反映当月景气变化方向。', how_to_read: '通常高于 50 表示较上月扩张，低于 50 表示收缩；看方向比看绝对值更重要。', related: '工业增加值 / 出口金额同比', comparable_group: 'index_point', importance: 3, sort_order: 17 },

    // 物价
    { code: 'cpi_yoy_cn_month', name: 'CPI 同比', alias: '居民消费价格 通胀', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 由上年同月=100 指数换算（指数-100）', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '居民消费价格指数相对上年同月的变动百分比，是衡量居民端通胀最常用的指标。', how_to_read: '统计局原始序列为「上年同月=100」指数，本表已换算为同比；连续数月同向变化比单月数值更有意义。', related: '核心 CPI 同比 / PPI 同比', comparable_group: 'pct_yoy', importance: 3, sort_order: 20 },
    { code: 'core_cpi_yoy_cn_month', name: '核心 CPI 同比', alias: '核心通胀', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 剔除食品和能源 / 由上年同月=100 指数换算（指数-100） / 2021 年起', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '剔除食品和能源后的居民消费价格同比，用于观察更稳定的价格趋势。', how_to_read: '与 CPI 同比的差值主要来自食品和能源的短期波动；国家数据的核心分项自 2021 年起提供，更早年份留空。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 21 },
    { code: 'ppi_yoy_cn_month', name: 'PPI 同比', alias: '工业生产者出厂价格', category: 'prices', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 工业生产者出厂价格 / 由上年同月=100 指数换算（指数-100）', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '工业产品第一次出售时价格相对上年同月的变动，反映工业端价格压力。', how_to_read: 'PPI 向 CPI 的传导并不总是成立，需结合需求端一起看。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 22 },
    { code: 'cpi_yoy_us_month', name: '美国 CPI 同比', alias: 'US CPI', category: 'prices', region: 'US', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 需注明季调或未季调', default_chart: 'line', source_name: '美国劳工统计局 (BLS)', source_url: 'https://www.bls.gov/cpi/', explainer: '美国城市消费者价格指数相对上年同月的变化。', how_to_read: '中美 CPI 的篮子权重与季调处理不同，跨地区只能比趋势方向，不能直接比高低。', related: 'CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 23, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },

    // 货币信贷
    { code: 'm2_yoy_cn_month', name: 'M2 同比', alias: '广义货币 货币供应量', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 期末值计算', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '广义货币供应量（货币和准货币）相对上年同月的增速，反映流动性宽裕程度。', how_to_read: '增速高低要结合名义 GDP 增速一起看，单看货币增速容易误判。', related: 'M1 同比 / 社融存量', comparable_group: 'pct_yoy', importance: 3, sort_order: 30 },
    { code: 'm1_yoy_cn_month', name: 'M1 同比', alias: '狭义货币', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 期末值计算', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '狭义货币供应量相对上年同月的增速，更多反映企业活期资金与经济活跃度。', how_to_read: 'M1 与 M2 增速的剪刀差常被用来观察资金是否「活化」，但口径曾调整，跨期比较需留意。', related: 'M2 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 31 },
    { code: 'm2_level_cn_month', name: 'M2 期末余额', alias: 'M2余额', category: 'money', region: 'CN', unit: '亿元', frequency: 'month', value_type: 'level', caliber: '期末值 / 存量', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '广义货币供应量的月末存量。', how_to_read: '存量适合看规模，同比适合看变化速度，两者不要混在同一张图。', related: 'M2 同比', comparable_group: 'cny_level', importance: 1, sort_order: 32 },
    { code: 'social_financing_cn_month', name: '社会融资规模存量', alias: '社融存量', category: 'money', region: 'CN', unit: '万亿元', frequency: 'month', value_type: 'level', caliber: '存量 / 期末值', default_chart: 'line', source_name: '中国人民银行', source_url: 'http://www.pbc.gov.cn/', explainer: '实体经济从金融体系获得的资金存量，覆盖贷款、债券、股票融资等。', how_to_read: '人民银行以公告和表格发布，本表仅保留可追溯的人工录入值。', related: 'M2 同比 / LPR', comparable_group: 'cny_trillion', importance: 2, sort_order: 33, gapReason: '人民银行未提供 JSON 接口，等待人工核对后录入。' },
    { code: 'lpr_1y_cn_month', name: '1 年期 LPR', alias: '贷款市场报价利率', category: 'money', region: 'CN', unit: '%', frequency: 'month', value_type: 'rate', caliber: '利率 / 月末报价', default_chart: 'line', source_name: '全国银行间同业拆借中心', source_url: 'https://www.chinamoney.com.cn/', explainer: '贷款市场报价利率，是银行贷款定价的主要参考。', how_to_read: '属于利率水平而非增速，不能用「涨跌颜色」表达同比含义。', related: '10 年期国债收益率', comparable_group: 'pct_rate', importance: 2, sort_order: 34, gapReason: '需人工核对每月报价发布时间，等待录入。' },

    // 就业与外贸：外贸词条归 trade 专题，新增的货物进出口序列见文件末尾第三批。
    { code: 'unemployment_cn_month', name: '城镇调查失业率', alias: '失业率 调查失业率', category: 'labor', region: 'CN', unit: '%', frequency: 'month', value_type: 'rate', caliber: '比率 / 全国城镇 / 调查口径', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '通过劳动力抽样调查得到的城镇失业人口占劳动力的比例。', how_to_read: '属于比率而非增速；青年等分项口径曾调整，跨期比较前先看口径说明。', related: 'PMI / 出口金额同比', comparable_group: 'pct_rate', importance: 3, sort_order: 40 },
    { code: 'exports_yoy_cn_month', name: '出口金额同比', alias: '出口增速', category: 'trade', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 美元计价 / 海关口径 / 由国家统计局国家数据转载', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '当月出口金额相对上年同月的变化，反映外部需求强弱。', how_to_read: '按美元计价，注意基数效应；与 PMI 新出口订单一起看更稳。', related: '制造业 PMI', comparable_group: 'pct_yoy', importance: 2, sort_order: 41 },
    { code: 'fx_reserve_cn_month', name: '外汇储备', alias: '外储', category: 'trade', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '期末值 / 存量', default_chart: 'line', source_name: '国家外汇管理局', source_url: 'https://www.safe.gov.cn/', explainer: '央行持有的对外金融资产储备月末余额。', how_to_read: '存量变动同时受估值与汇率影响，不等于资本净流入。', related: '出口金额同比', comparable_group: 'usd_100m', importance: 1, sort_order: 42, gapReason: '需人工核对后录入。' },

    // 财政人口
    { code: 'population_cn_year', name: '年末总人口', alias: '总人口 人口', category: 'fiscal', region: 'CN', unit: '万人', frequency: 'year', value_type: 'level', caliber: '年末存量 / 全国', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '每年年末的全国总人口，是长期结构分析的基础变量。', how_to_read: '年度频率，适合与人均 GDP、劳动力相关指标一起看。', related: '人均国内生产总值', comparable_group: 'wan_people', importance: 3, sort_order: 50 },
    { code: 'fiscal_revenue_cn_year', name: '一般公共预算收入', alias: '财政收入', category: 'fiscal', region: 'CN', unit: '亿元', frequency: 'year', value_type: 'level', caliber: '年度累计 / 名义 / 统计汇编口径', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '一般公共预算的年度收入合计，反映政府可支配财力。', how_to_read: '与支出一起看收支缺口；注意年度决算与预算执行数的差别。本表取自国家统计局年度财政表（原始来源财政部）。', related: '一般公共预算支出', comparable_group: 'cny_level', importance: 2, sort_order: 51 },
    { code: 'gdp_yoy_us_quarter', name: '美国 GDP 环比折年率', alias: 'US GDP annualized', category: 'growth', region: 'US', unit: '%', frequency: 'quarter', value_type: 'growth', caliber: '环比折年率 / 季调 / 实际', default_chart: 'bar', source_name: '美国经济分析局 (BEA)', source_url: 'https://www.bea.gov/', explainer: '把当季相对上季的环比增速外推成全年增速，是美国季度 GDP 的常见发布口径。', how_to_read: '会放大当季波动，与中国发布的同比不是同一口径，不能直接连线比较。', related: 'GDP 实际同比', comparable_group: 'pct_qoq_annualized', importance: 2, sort_order: 18, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },
    { code: 'gdp_yoy_eu_quarter', name: '欧元区 GDP 同比', alias: 'EU GDP', category: 'growth', region: 'EU', unit: '%', frequency: 'quarter', value_type: 'growth', caliber: '同比 / 季调 / 实际', default_chart: 'line', source_name: '欧盟统计局 (Eurostat)', source_url: 'https://ec.europa.eu/eurostat', explainer: '欧元区实际 GDP 相对上年同季的变化。', how_to_read: '季调处理与中国口径不同，跨地区只宜比较趋势方向。', related: 'GDP 实际同比', comparable_group: 'pct_yoy', importance: 1, sort_order: 19, gapReason: '海外数据源尚未验证可达性与授权，暂不灌入数值。' },

    // 第二批新增维度：内需、工业、投资与地产，全部来自同一国家统计局接口。
    // 累计同比与当月同比口径不同，用不同的 comparable_group 分开，避免跨口径叠加。
    { code: 'retail_sales_yoy_cn_month', name: '社会消费品零售总额同比', alias: '社零增速 消费', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 当月 / 名义', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '社会消费品零售总额相对上年同月的变化，是观察居民消费与内需最常用的月度指标。', how_to_read: '年初 1—2 月官方常合并公布，序列可能留空；与固定资产投资增速一起看内需结构。', related: '固定资产投资增速 / CPI 同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 60 },
    { code: 'industrial_va_yoy_cn_month', name: '规上工业增加值同比', alias: '工业增加值增速', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '同比 / 当月 / 实际（剔除价格）', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '规模以上工业企业增加值相对上年同月的实际增长，反映工业生产的当月景气。', how_to_read: '已剔除价格因素，不要与名义产值增速混用；年初 1—2 月常合并公布。', related: '制造业 PMI / 固定资产投资增速', comparable_group: 'pct_yoy', importance: 2, sort_order: 61 },
    { code: 'fai_yoy_cn_month', name: '固定资产投资增速', alias: '固投增速', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '累计同比 / 年初至当月 / 不含农户', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '固定资产投资（不含农户）自年初累计到当月的同比增长，反映投资力度。', how_to_read: '这是累计同比而非当月同比，年初会重置口径，不宜与社零等当月同比直接叠加。', related: '房地产开发投资增速 / 社会消费品零售总额同比', comparable_group: 'pct_yoy_cum', importance: 2, sort_order: 62 },
    { code: 'real_estate_invest_yoy_cn_month', name: '房地产开发投资增速', alias: '房地产投资', category: 'growth', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '累计同比 / 年初至当月', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '房地产开发投资自年初累计到当月的同比增长，观察地产周期与投资拖累。', how_to_read: '同为累计同比，可与固定资产投资增速叠看；与商品房销售面积一起看更完整。', related: '固定资产投资增速', comparable_group: 'pct_yoy_cum', importance: 2, sort_order: 63 },

    // 第三批：货物进出口全套，取自国家统计局「国家数据」月度货物进出口目录（原始来源海关总署）。
    // 接口原始单位为千美元，scripts/import_stats.py 统一换算为亿美元；当月值与同比分属不同 comparable_group。
    { code: 'trade_total_cn_month', name: '进出口总值', alias: '进出口总额 外贸总额 进出口金额', category: 'trade', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '当月值 / 美元计价 / 海关口径 / 货物贸易', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '当月货物出口与进口金额之和，是观察外贸整体规模最常用的月度指标。', how_to_read: '看规模用当月金额，看冷热改用同比；美元计价含汇率折算影响，不要与人民币计价序列连线比较。', related: '出口总值 / 进口总值 / 进出口总值同比', comparable_group: 'usd_100m', importance: 3, sort_order: 43 },
    { code: 'exports_level_cn_month', name: '出口总值', alias: '出口金额 出口额', category: 'trade', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '当月值 / 美元计价 / 海关口径', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '当月货物出口金额，直接对应外部需求。', how_to_read: '与进口总值一起看可推算顺差变化；金额受价格与汇率影响，判断景气建议配合出口同比。', related: '进口总值 / 贸易差额 / 出口金额同比', comparable_group: 'usd_100m', importance: 2, sort_order: 44 },
    { code: 'imports_level_cn_month', name: '进口总值', alias: '进口金额 进口额', category: 'trade', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '当月值 / 美元计价 / 海关口径', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '当月货物进口金额，同时反映内需和大宗商品价格。', how_to_read: '进口回升未必只代表内需转好，原油等大宗商品涨价也会推高金额。', related: '出口总值 / 贸易差额', comparable_group: 'usd_100m', importance: 2, sort_order: 45 },
    { code: 'trade_balance_cn_month', name: '贸易差额', alias: '贸易顺差 贸易逆差 进出口差额', category: 'trade', region: 'CN', unit: '亿美元', frequency: 'month', value_type: 'level', caliber: '当月值 / 美元计价 / 出口减进口 / 可为负', default_chart: 'bar', source_name: STATS.name, source_url: STATS.url, explainer: '当月出口总值减去进口总值，正数为顺差、负数为逆差。', how_to_read: '差额是流量差，不等于外汇储备变动；单月波动大，建议看滚动趋势。', related: '出口总值 / 进口总值', comparable_group: 'usd_100m', importance: 2, sort_order: 46 },
    { code: 'trade_total_yoy_cn_month', name: '进出口总值同比', alias: '外贸增速 进出口增速', category: 'trade', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '当月同比 / 美元计价 / 海关口径', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '当月进出口总额相对上年同月的变化，是外贸冷热最常用的速度指标。', how_to_read: '低基数会放大增速，需与当月金额对照看；与 PMI 新出口订单一起判断更稳。', related: '进出口总值 / 出口金额同比 / 进口总值同比', comparable_group: 'pct_yoy', importance: 3, sort_order: 47 },
    { code: 'imports_yoy_cn_month', name: '进口总值同比', alias: '进口增速', category: 'trade', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '当月同比 / 美元计价 / 海关口径', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '当月进口金额相对上年同月的变化，反映内需与进口价格。', how_to_read: '与出口同比的差可观察内外需强弱；注意基数效应和大宗商品价格扰动。', related: '出口金额同比 / 进出口总值同比', comparable_group: 'pct_yoy', importance: 2, sort_order: 48 },
    { code: 'trade_total_cum_yoy_cn_month', name: '进出口总值累计同比', alias: '累计外贸增速', category: 'trade', region: 'CN', unit: '%', frequency: 'month', value_type: 'growth', caliber: '累计同比 / 年初至当月 / 美元计价', default_chart: 'line', source_name: STATS.name, source_url: STATS.url, explainer: '自年初累计到当月的进出口总额相对上年同期增速。', how_to_read: '这是累计同比而非当月同比，年初会重置口径，不要与当月同比连线或叠加。', related: '进出口总值同比 / 固定资产投资增速', comparable_group: 'pct_yoy_cum', importance: 1, sort_order: 49 },
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
