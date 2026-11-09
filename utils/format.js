function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function formatNumber(value, digits) {
    const n = toNumber(value);
    if (n === null) return '—';
    const d = typeof digits === 'number' ? digits : (Math.abs(n) >= 1000 ? 0 : 2);
    const fixed = n.toFixed(d);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function periodRank(period) {
    const p = String(period || '');
    const q = /^(\d{4})Q(\d)$/.exec(p);
    if (q) return Number(q[1]) + (Number(q[2]) - 1) / 4;
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (m) return Number(m[1]) + (Number(m[2]) - 1) / 12;
    const y = /^(\d{4})$/.exec(p);
    if (y) return Number(y[1]);
    return 0;
}

function formatPeriod(period, periodType) {
    const p = String(period || '—');
    const q = /^(\d{4})Q(\d)$/.exec(p);
    if (q) return q[1] + ' 年 Q' + q[2];
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (m) return m[1] + ' 年 ' + Number(m[2]) + ' 月';
    if (/^\d{4}$/.test(p)) return p + ' 年';
    return p;
}

function shortPeriod(period) {
    const p = String(period || '');
    const q = /^(\d{4})Q(\d)$/.exec(p);
    if (q) return q[1].slice(2) + 'Q' + q[2];
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (m) return m[1].slice(2) + '/' + m[2];
    return p.slice(-2) || p;
}

// 迷你趋势条：把数值归一化成 12%~92% 的高度，避免 0 高度不可见。
function sparkBars(values) {
    const nums = (values || []).map(toNumber).filter(function (n) { return n !== null; });
    if (nums.length === 0) return [];
    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    const span = max - min || 1;
    const bars = [];
    (values || []).forEach(function (v) {
        const n = toNumber(v);
        if (n === null) return;
        bars.push(Math.round(12 + ((n - min) / span) * 80));
    });
    return bars;
}

function deltaText(current, previous, unit) {
    const c = toNumber(current);
    const p = toNumber(previous);
    if (c === null || p === null) return '较上期 —';
    const diff = c - p;
    const sign = diff > 0 ? '+' : '';
    return '较上期 ' + sign + formatNumber(diff, 2) + (unit || '');
}

function safeText(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback || '';
    return String(value);
}

module.exports = {
    toNumber: toNumber,
    formatNumber: formatNumber,
    formatPeriod: formatPeriod,
    shortPeriod: shortPeriod,
    periodRank: periodRank,
    sparkBars: sparkBars,
    deltaText: deltaText,
    safeText: safeText,
};
