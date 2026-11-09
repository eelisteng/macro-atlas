const repo = require('../../utils/repository');
const vm = require('../../utils/viewmodel');
const { TOPICS, topicByKey } = require('../../utils/indicators');
const { COLORS } = require('../../utils/chart');

Page({
    data: {
        viewState: 'loading',
        errorText: '',
        categories: TOPICS,
        activeCategory: 'growth',
        topicName: '',
        topicDesc: '',
        charts: [],
        gaps: [],
        list: [],
    },

    onLoad: function (options) {
        this._category = options && options.category ? options.category : 'growth';
        this.load();
    },

    load: function () {
        const that = this;
        const category = this._category;
        this.setData({ viewState: 'loading', errorText: '', activeCategory: category });
        (async function () {
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const recent = await repo.listRecentPoints();
            if (recent.error) throw new Error(recent.error);
            const grouped = vm.rowsByIndicator(recent.data);
            const items = (ind.data || []).filter(function (x) { return x.category === category; });
            const topic = topicByKey(category) || TOPICS[0];

            const charts = [];
            const gaps = [];
            const list = [];
            items.forEach(function (item) {
                const rows = grouped[item.id] || [];
                const entry = {
                    code: item.code,
                    name: item.name,
                    caliber: vm.caliberLabel(item),
                    hasData: rows.length > 0,
                    reason: vm.gapText(item),
                    region: item.region,
                };
                list.push(entry);
                if (rows.length === 0) {
                    gaps.push(entry);
                    return;
                }
                if (charts.length >= 3) return;
                const periods = vm.sliceByRange(vm.sortedPeriods(rows), item.frequency, '10');
                const mode = item.value_type === 'growth' && item.default_chart === 'bar' ? 'bar' : 'line';
                charts.push({
                    code: item.code,
                    title: item.name,
                    caliber: item.caliber,
                    periods: periods,
                    series: [vm.buildSeries(item, rows, periods, COLORS[charts.length % COLORS.length])],
                    mode: mode,
                    dualAxis: false,
                    growthMode: item.value_type === 'growth' && mode === 'bar',
                    sourceText: vm.sourceText(item, rows[rows.length - 1]),
                    height: 200,
                });
            });

            that.setData({
                viewState: 'ready',
                topicName: topic.name,
                topicDesc: topic.description,
                charts: charts,
                gaps: gaps,
                list: list,
            });
        })().catch(function (err) {
            that.setData({ viewState: 'error', errorText: err.message || '数据加载失败' });
        });
    },

    onCategoryTap: function (event) {
        this._category = event.currentTarget.dataset.key;
        this.load();
    },
    onIndicatorTap: function (event) {
        wx.navigateTo({ url: '/pages/detail/detail?code=' + event.currentTarget.dataset.code });
    },
    onRetry: function () { this.load(); },
    onSearchTap: function () { wx.navigateTo({ url: '/pages/search/search' }); },
    onShareAppMessage: function () {
        return { title: '宏观图鉴 · 经济数据专题', path: '/pages/topics/topics' };
    },
});
