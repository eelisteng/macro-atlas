// 把数据库行整理成页面直接使用的数据结构；复杂计算留在 JS，不在 WXML 里做。
const fmt = require('./format');
const { FREQUENCY_NAMES, REGION_NAMES, SOURCE_CITE } = require('./indicators');

var RANGE_LABELS = [
    { key: '5', label: '近 5 年' },
    { key: '10', label: '近 10 年' },
    { key: 'all', label: '全部' },
];
var FEATURED = [
    'gdp_nominal_cn_year',
    'cpi_yoy_cn_month',
    'pmi_manufacturing_cn_month',
    'm2_yoy_cn_month',
];

function sortedPeriods(rows) {
    var set = {};
    (rows || []).forEach(function (r) { set[r.period] = true; });
    return Object.keys(set).sort(function (a, b) { return fmt.periodRank(a) - fmt.periodRank(b); });
}

function sliceByRange(periods, frequency, range) {
    if (range === 'all') return periods;
    var years = Number(range) || 5;
    var count = frequency === 'month' ? years * 12 : (frequency === 'quarter' ? years * 4 : years);
    if (periods.length <= count) return periods;
    return periods.slice(periods.length - count);
}

function buildSeries(indicator, rows, periods, color) {
    var map = {};
    (rows || []).forEach(function (r) { map[r.period] = r; });
    var points = periods.map(function (p) {
        return { period: p, value: map[p] ? map[p].value : null };
    });
    return {
        label: (indicator.region && indicator.region !== 'CN' ? REGION_NAMES[indicator.region] + ' · ' : '') + indicator.name,
        unit: indicator.unit || '',
        color: color,
        points: points,
        caliber: indicator.caliber || '',
    };
}

function latestByIndicator(rows) {
    var map = {};
    (rows || []).forEach(function (r) {
        var key = r.indicator_id;
        if (!map[key] || fmt.periodRank(r.period) > fmt.periodRank(map[key].period)) map[key] = r;
    });
    return map;
}

function rowsByIndicator(rows) {
    var map = {};
    (rows || []).forEach(function (r) {
        if (!map[r.indicator_id]) map[r.indicator_id] = [];
        map[r.indicator_id].push(r);
    });
    Object.keys(map).forEach(function (key) {
        map[key].sort(function (a, b) { return fmt.periodRank(a.period) - fmt.periodRank(b.period); });
    });
    return map;
}

function sparkFromRows(rows, count) {
    var ordered = (rows || []).slice().sort(function (a, b) { return fmt.periodRank(a.period) - fmt.periodRank(b.period); });
    return fmt.sparkBars(ordered.slice(-(count || 12)).map(function (r) { return r.value; }));
}

function caliberLabel(indicator) {
    return (FREQUENCY_NAMES[indicator.frequency] || '') + ' · ' + (REGION_NAMES[indicator.region] || '') + ' · ' + (indicator.unit || '');
}

function sourceText(indicator, row) {
    var source = (row && row.source) || indicator.source_name || '未标注来源';
    return '数据来源：' + source + ' · 宏观图鉴';
}

function revisionBadge(row) {
    if (!row) return '';
    if (row.revision === 'initial') return '初值';
    if (row.revision === 'revised') return '修订';
    return '终值';
}

function gapText(indicator) {
    return indicator.gapReason || '该指标暂无可用数据';
}

module.exports = {
    RANGE_LABELS: RANGE_LABELS,
    FEATURED: FEATURED,
    SOURCE_CITE: SOURCE_CITE,
    sortedPeriods: sortedPeriods,
    sliceByRange: sliceByRange,
    buildSeries: buildSeries,
    latestByIndicator: latestByIndicator,
    rowsByIndicator: rowsByIndicator,
    sparkFromRows: sparkFromRows,
    caliberLabel: caliberLabel,
    sourceText: sourceText,
    revisionBadge: revisionBadge,
    gapText: gapText,
};
