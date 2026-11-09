const repo = require('../../utils/repository');
const vm = require('../../utils/viewmodel');
const fmt = require('../../utils/format');
const { COLORS } = require('../../utils/chart');
const { REGION_NAMES, FREQUENCY_NAMES, SOURCE_CITE } = require('../../utils/indicators');

Page({
    data: {
        viewState: 'loading',
        errorText: '',
        code: '',
        name: '',
        explainer: '',
        howToRead: '',
        related: '',
        caliber: '',
        metaText: '',
        sourceName: '',
        sourceUrl: '',
        gapReason: '',
        hasData: false,
        range: '10',
        ranges: vm.RANGE_LABELS,
        mode: 'line',
        charts: [],
        caliberLabels: [],
        compareNames: [],
        compareName: '',
        compareMode: 'single',
        compareWarning: '',
        showCompare: false,
        highlightIndex: -1,
        selectedPoint: null,
        tableRows: [],
        sourceCite: SOURCE_CITE,
    },

    onLoad: function (options) {
        this._code = (options && options.code) || '';
        this._indicators = [];
        this._rows = [];
        this._compareRows = [];
        this.load();
    },

    load: function () {
        const that = this;
        this.setData({ viewState: 'loading', errorText: '' });
        (async function () {
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const list = ind.data || [];
            const current = list.filter(function (x) { return x.code === that._code; })[0];
            if (!current) throw new Error('未找到该指标');
            that._indicators = list;
            that._current = current;
            const points = await repo.listPoints(current.id, 500);
            if (points.error) throw new Error(points.error);
            that._rows = points.data || [];

            that.setData({
                viewState: 'ready',
                code: current.code,
                name: current.name,
                explainer: current.explainer || '该指标暂无释义，可在指标库中补充。',
                howToRead: current.how_to_read || '请参考口径与来源说明。',
                related: current.related || '—',
                caliber: current.caliber || '未标注口径',
                metaText: (FREQUENCY_NAMES[current.frequency] || '') + ' · ' + (REGION_NAMES[current.region] || '') + ' · 单位 ' + (current.unit || '—'),
                sourceName: current.source_name || '未标注来源',
                sourceUrl: current.source_url || '',
                gapReason: vm.gapText(current),
                compareNames: ['不对比'].concat(list.filter(function (x) { return x.code !== current.code; }).map(function (x) { return x.name; })),
                mode: current.value_type === 'growth' && current.default_chart === 'bar' ? 'bar' : 'line',
            });
            wx.setNavigationBarTitle({ title: current.name });
            that.rebuild();
        })().catch(function (err) {
            that.setData({ viewState: 'error', errorText: err.message || '数据加载失败' });
        });
    },

    rebuild: function () {
        const that = this;
        const current = this._current;
        const rows = this._rows;
        const compare = this._compareIndicator;
        const compareRows = this._compareRows;
        const mainPeriods = vm.sliceByRange(vm.sortedPeriods(rows), current.frequency, this.data.range);
        const growth = current.value_type === 'growth';
        const charts = [];
        const labels = [];
        let compareMode = 'single';
        let warning = '';

        if (compare) {
            const otherPeriods = vm.sliceByRange(vm.sortedPeriods(compareRows), compare.frequency, this.data.range);
            const sameGroup = current.comparable_group === compare.comparable_group;
            if (!sameGroup) {
                // 口径/单位不同：禁止叠加，改为并排小多图。
                compareMode = 'small';
                warning = '两个指标的口径或单位不同，已改为并排小多图，禁止叠加比较。';
                charts.push(this.makeChart(current, rows, mainPeriods, COLORS[0], growth && this.data.mode === 'bar'));
                charts.push(this.makeChart(compare, compareRows, otherPeriods, COLORS[1], false));
                labels.push(current.name + '：' + current.caliber);
                labels.push(compare.name + '：' + compare.caliber);
            } else {
                compareMode = 'overlay';
                const union = {};
                mainPeriods.concat(otherPeriods).forEach(function (p) { union[p] = true; });
                const periods = Object.keys(union).sort(function (a, b) { return fmt.periodRank(a) - fmt.periodRank(b); });
                charts.push({
                    key: 'overlay-' + current.code + '-' + compare.code,
                    periods: periods,
                    series: [
                        vm.buildSeries(current, rows, periods, COLORS[0]),
                        vm.buildSeries(compare, compareRows, periods, COLORS[1]),
                    ],
                    mode: 'line',
                    dualAxis: true,
                    growthMode: false,
                    sourceText: vm.sourceText(current, rows[rows.length - 1]),
                    height: 220,
                });
                labels.push(current.name + '：' + current.caliber);
                labels.push(compare.name + '：' + compare.caliber);
                if (current.region !== compare.region) {
                    warning = '跨地区比较：两条线的口径标签已随线显示，只宜比较趋势方向，不宜直接比高低。';
                } else {
                    warning = '双轴展示：左右轴各自标单位，请勿把量级不同的两条线当作同一尺度。';
                }
            }
        } else {
            charts.push(this.makeChart(current, rows, mainPeriods, COLORS[0], growth && this.data.mode === 'bar'));
            labels.push(current.name + '：' + current.caliber);
        }

        const tableRows = rows.slice(-8).reverse().map(function (r) {
            const value = fmt.toNumber(r.value);
            const consensus = fmt.toNumber(r.consensus);
            let surprise = '';
            if (value !== null && consensus !== null) {
                const diff = value - consensus;
                surprise = diff > 0 ? '超预期 +' + fmt.formatNumber(diff, 2) : (diff < 0 ? '不及预期 ' + fmt.formatNumber(diff, 2) : '符合预期');
            }
            return {
                id: r.id,
                period: fmt.formatPeriod(r.period, r.period_type),
                value: fmt.formatNumber(r.value) + (r.unit || current.unit || ''),
                badge: vm.revisionBadge(r),
                surprise: surprise,
                source: r.source || current.source_name || '未标注',
                gap: value === null,
            };
        });

        that.setData({
            compareMode: compareMode,
            compareWarning: warning,
            charts: charts,
            caliberLabels: labels,
            hasData: rows.length > 0,
            tableRows: tableRows,
            highlightIndex: -1,
            selectedPoint: null,
        });
    },

    makeChart: function (indicator, rows, periods, color, barMode) {
        return {
            key: indicator.code + '-single',
            periods: periods,
            series: [vm.buildSeries(indicator, rows, periods, color)],
            mode: barMode ? 'bar' : 'line',
            dualAxis: false,
            growthMode: barMode,
            sourceText: vm.sourceText(indicator, rows[rows.length - 1]),
            height: 220,
        };
    },

    onRangeTap: function (event) {
        this.setData({ range: event.currentTarget.dataset.key });
        this.rebuild();
    },
    onModeTap: function (event) {
        this.setData({ mode: event.currentTarget.dataset.mode });
        this.rebuild();
    },
    onComparePick: function (event) {
        const index = Number(event.detail.value);
        if (index === 0) {
            this._compareIndicator = null;
            this._compareRows = [];
            this.setData({ compareName: '' });
            this.rebuild();
            return;
        }
        const others = this._indicators.filter(function (x) { return x.code !== this._code; }.bind(this));
        const target = others[index - 1];
        if (!target) return;
        const that = this;
        this.setData({ compareName: target.name, viewState: 'loading' });
        repo.listPoints(target.id, 500).then(function (res) {
            if (res.error) {
                that.setData({ viewState: 'ready', compareName: '', compareWarning: res.error });
                return;
            }
            that._compareIndicator = target;
            that._compareRows = res.data || [];
            that.setData({ viewState: 'ready' });
            that.rebuild();
        });
    },
    onPointTap: function (event) {
        const detail = event.detail;
        const row = this._rows.filter(function (r) { return r.period === detail.period; })[0];
        if (!row) return;
        const current = this._current;
        const value = fmt.toNumber(row.value);
        const consensus = fmt.toNumber(row.consensus);
        let surprise = '';
        if (value !== null && consensus !== null) {
            const diff = value - consensus;
            surprise = diff > 0 ? '超预期 +' + fmt.formatNumber(diff, 2) : (diff < 0 ? '不及预期 ' + fmt.formatNumber(diff, 2) : '符合预期');
        }
        this.setData({
            highlightIndex: detail.index,
            selectedPoint: {
                period: fmt.formatPeriod(row.period, row.period_type),
                value: fmt.formatNumber(row.value) + (row.unit || current.unit || ''),
                previous: fmt.formatNumber(row.previous) + (row.unit || current.unit || ''),
                consensus: fmt.formatNumber(row.consensus) + (row.unit || current.unit || ''),
                revised: fmt.formatNumber(row.revised) + (row.unit || current.unit || ''),
                surprise: surprise,
                source: row.source || current.source_name || '未标注来源',
                releaseDate: row.release_date || '未登记',
                badge: vm.revisionBadge(row),
                caliber: row.caliber || current.caliber || '未标注口径',
                note: row.note || '无备注',
                gapReason: row.gap_reason || '—',
                id: row.id,
            },
        });
        this.rebuildChartsHighlight();
    },
    rebuildChartsHighlight: function () {
        const charts = this.data.charts.map(function (c) { return Object.assign({}, c); });
        this.setData({ charts: charts, highlightIndex: this.data.highlightIndex });
    },
    closePoint: function () {
        this.setData({ selectedPoint: null, highlightIndex: -1 });
        this.rebuildChartsHighlight();
    },
    onShareImage: function () {
        const comp = this.selectComponent('#chart-0');
        if (!comp) { wx.showToast({ title: '图表尚未就绪', icon: 'none' }); return; }
        comp.exportImage().then(function (path) {
            wx.saveImageToPhotosAlbum({
                filePath: path,
                success: function () { wx.showToast({ title: '已保存分享图', icon: 'success' }); },
                fail: function (err) {
                    const denied = String(err.errMsg || '').indexOf('auth deny') >= 0 || String(err.errMsg || '').indexOf('authorize') >= 0;
                    wx.showToast({ title: denied ? '需要授权保存到相册' : '保存失败', icon: 'none' });
                },
            });
        }).catch(function () {
            wx.showToast({ title: '图表导出失败', icon: 'none' });
        });
    },
    onGoData: function () {
        wx.navigateTo({ url: '/pages/data/data?code=' + this.data.code });
    },
    onRetry: function () { this.load(); },
    onShareAppMessage: function () {
        var code = this.data.code || '';
        var name = this.data.name || '';
        return {
            title: name ? '宏观图鉴 · ' + name : '宏观图鉴 · 看懂十年经济数据',
            path: code ? '/pages/detail/detail?code=' + code : '/pages/index/index',
        };
    },
});
