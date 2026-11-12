// 轻量 Canvas 2D 图表渲染：折线 / 柱状 / 双轴，无第三方图表库，控制主包体积。
// 空值不入图：value 为 null 的点用断开的线段表示，不补零、不插值。
const { shortPeriod, toNumber } = require('./format');

var COLORS = ['#185FA5', '#BA7517', '#0F6E56', '#993C1D'];
var POSITIVE = '#D0453B';
var NEGATIVE = '#1D9E75';
var GRID = '#E8EBF0';
var AXIS = '#8A8F99';
var TEXT = '#5F5E5A';

function niceRange(min, max) {
    if (min === Infinity || max === -Infinity) return { min: 0, max: 1 };
    if (min === max) {
        var pad = Math.abs(min) * 0.1 || 1;
        return { min: min - pad, max: max + pad };
    }
    var span = max - min;
    return { min: min - span * 0.12, max: max + span * 0.12 };
}

function collectRange(points) {
    var min = Infinity;
    var max = -Infinity;
    points.forEach(function (p) {
        var n = toNumber(p.value);
        if (n === null) return;
        if (n < min) min = n;
        if (n > max) max = n;
    });
    return niceRange(min, max);
}

function fillText(ctx, text, x, y, align, color, size) {
    ctx.fillStyle = color || TEXT;
    ctx.font = (size || 11) + 'px sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x, y);
}

/**
 * config = {
 *   periods: ['2020','2021',...],
 *   series: [{ label, unit, color, points: [{period, value}] }],
 *   mode: 'line' | 'bar',
 *   dualAxis: boolean,
 *   growthMode: boolean,   // 增速柱状用红涨绿跌
 *   sourceText: string,
 *   highlightIndex: number
 * }
 * 返回 hitAreas，供组件做点击命中。
 */
function draw(ctx, width, height, config) {
    var cfg = config || {};
    var periods = cfg.periods || [];
    var series = cfg.series || [];
    var dual = !!cfg.dualAxis && series.length > 1;
    var padL = 46;
    var padR = dual ? 46 : 14;
    var padT = 12;
    var padB = 34;
    var sourceH = cfg.sourceText ? 16 : 0;
    var plotW = Math.max(10, width - padL - padR);
    var plotH = Math.max(10, height - padT - padB - sourceH);
    var hitAreas = [];

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    if (periods.length === 0 || series.length === 0) {
        fillText(ctx, '该指标暂无可用数据', width / 2, height / 2, 'center', AXIS, 12);
        return hitAreas;
    }

    var ranges = [];
    series.forEach(function (s) { ranges.push(collectRange(s.points || [])); });
    var barSingle = cfg.mode === 'bar' && series.length === 1;
    // 柱状图必须以 0 为基线。若数值全为正，niceRange 会把 min 抬到 0 以上，
    // 此时柱顶与零点不在同一坐标系里，柱子会被画到画布外。这里统一把范围扩到含 0，
    // Y 轴刻度也因此能显示 0，避免读者误判量级。
    if (barSingle && ranges[0]) {
        if (ranges[0].min > 0) ranges[0].min = 0;
        if (ranges[0].max < 0) ranges[0].max = 0;
    }
    var mainRange = ranges[0];

    // 轴标签宽度随数值变化：GDP 等六位数标签用固定的 46px 左边距会被画布裁掉。
    // 先量文本，再动态扩展左右留白，保证所有刻度数字完整可见。
    ctx.font = '10px sans-serif';
    var leftLabels = [];
    var rightLabels = [];
    var maxLeftW = 0;
    var maxRightW = 0;
    var r2 = dual ? ranges[1] : null;
    for (var li = 0; li <= 4; li += 1) {
        var lv = String(Math.round((mainRange.max - ((mainRange.max - mainRange.min) / 4) * li) * 100) / 100);
        leftLabels.push(lv);
        maxLeftW = Math.max(maxLeftW, ctx.measureText(lv).width);
        if (r2) {
            var rv = String(Math.round((r2.max - ((r2.max - r2.min) / 4) * li) * 100) / 100);
            rightLabels.push(rv);
            maxRightW = Math.max(maxRightW, ctx.measureText(rv).width);
        }
    }
    padL = Math.max(46, Math.ceil(maxLeftW) + 12);
    padR = dual ? Math.max(46, Math.ceil(maxRightW) + 12) : 14;
    plotW = Math.max(10, width - padL - padR);
    plotH = Math.max(10, height - padT - padB - sourceH);

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g += 1) {
        var gy = padT + (plotH / 4) * g;
        ctx.beginPath();
        ctx.moveTo(padL, gy);
        ctx.lineTo(padL + plotW, gy);
        ctx.stroke();
        fillText(ctx, leftLabels[g], padL - 6, gy, 'right', AXIS, 10);
    }
    if (r2) {
        for (var g2 = 0; g2 <= 4; g2 += 1) {
            var gy2 = padT + (plotH / 4) * g2;
            fillText(ctx, rightLabels[g2], padL + plotW + 6, gy2, 'left', AXIS, 10);
        }
    }

    var step = periods.length > 1 ? plotW / (periods.length - 1) : 0;
    function xAt(i) { return padL + (periods.length > 1 ? step * i : plotW / 2); }
    function yAt(value, range) {
        var span = range.max - range.min || 1;
        return padT + plotH - ((value - range.min) / span) * plotH;
    }

    // 零轴：柱状图以 0 为基线，增速图与含负值的折线图也必须显示，避免视觉误读。
    var showZeroLine = barSingle || cfg.growthMode || (mainRange.min < 0 && mainRange.max > 0);
    if (showZeroLine && mainRange.min <= 0 && mainRange.max >= 0) {
        var zeroY = yAt(0, mainRange);
        ctx.strokeStyle = '#B4B8C0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, zeroY);
        ctx.lineTo(padL + plotW, zeroY);
        ctx.stroke();
    }

    if (barSingle) {
        var barW = Math.max(2, Math.min(18, plotW / periods.length * 0.62));
        var zeroBar = yAt(0, ranges[0]);
        series[0].points.forEach(function (p, i) {
            var n = toNumber(p.value);
            if (n === null) return;
            var y = yAt(n, ranges[0]);
            var top = Math.min(y, zeroBar);
            var h = Math.max(1, Math.abs(zeroBar - y));
            ctx.fillStyle = cfg.growthMode ? (n >= 0 ? POSITIVE : NEGATIVE) : (series[0].color || COLORS[0]);
            ctx.fillRect(xAt(i) - barW / 2, top, barW, h);
            hitAreas.push({ x: xAt(i), y: top, index: i, period: periods[i], value: n, label: series[0].label });
        });
    } else {
        series.forEach(function (s, si) {
            var range = dual ? ranges[Math.min(si, ranges.length - 1)] : mainRange;
            var color = s.color || COLORS[si % COLORS.length];
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            var started = false;
            (s.points || []).forEach(function (p, i) {
                var n = toNumber(p.value);
                if (n === null) { started = false; return; }
                var px = xAt(i);
                var py = yAt(n, range);
                if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
                if (si === 0) {
                    hitAreas.push({ x: px, y: py, index: i, period: periods[i], value: n, label: s.label });
                }
            });
            ctx.stroke();
            var last = null;
            for (var k = (s.points || []).length - 1; k >= 0; k -= 1) {
                if (toNumber((s.points || [])[k].value) !== null) { last = (s.points || [])[k]; break; }
            }
            if (last) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(xAt((s.points || []).indexOf(last)), yAt(toNumber(last.value), range), 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    var labelEvery = Math.max(1, Math.ceil(periods.length / 5));
    for (var xi = 0; xi < periods.length; xi += labelEvery) {
        fillText(ctx, shortPeriod(periods[xi]), xAt(xi), padT + plotH + 12, 'center', AXIS, 10);
    }
    if (periods.length > 1 && (periods.length - 1) % labelEvery !== 0) {
        fillText(ctx, shortPeriod(periods[periods.length - 1]), xAt(periods.length - 1), padT + plotH + 12, 'center', AXIS, 10);
    }

    if (typeof cfg.highlightIndex === 'number' && hitAreas.length > 0) {
        var hit = null;
        hitAreas.forEach(function (a) { if (a.index === cfg.highlightIndex) hit = a; });
        if (hit) {
            ctx.strokeStyle = '#C9CDD4';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(hit.x, padT);
            ctx.lineTo(hit.x, padT + plotH);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(hit.x, hit.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = COLORS[0];
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    if (cfg.sourceText) {
        fillText(ctx, cfg.sourceText, 4, height - 8, 'left', '#9A9EA6', 10);
    }
    return hitAreas;
}

module.exports = { draw: draw, COLORS: COLORS };
