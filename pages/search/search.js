const repo = require('../../utils/repository');
const { searchIndicators, REGION_NAMES, FREQUENCY_NAMES } = require('../../utils/indicators');
const vm = require('../../utils/viewmodel');

Page({
    data: {
        keyword: '',
        results: [],
        loading: true,
        errorText: '',
    },

    onLoad: function () { this.load(); },

    load: function () {
        const that = this;
        (async function () {
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const recent = await repo.listRecentPoints();
            if (recent.error) throw new Error(recent.error);
            const grouped = vm.rowsByIndicator(recent.data);
            that._availability = {};
            Object.keys(grouped).forEach(function (id) { that._availability[id] = grouped[id].length; });
            that._indicators = ind.data || [];
            that.setData({ loading: false });
            that.applyFilter(that.data.keyword);
        })().catch(function (err) {
            that.setData({ loading: false, errorText: err.message || '加载失败' });
        });
    },

    applyFilter: function (keyword) {
        const availability = this._availability || {};
        const byCode = {};
        (this._indicators || []).forEach(function (item) { byCode[item.code] = item; });
        const results = searchIndicators(keyword).map(function (item) {
            const dbItem = byCode[item.code];
            const count = dbItem ? (availability[dbItem.id] || 0) : 0;
            return {
                code: item.code,
                name: item.name,
                alias: item.alias,
                meta: (FREQUENCY_NAMES[item.frequency] || '') + ' · ' + (REGION_NAMES[item.region] || '') + ' · ' + (item.unit || ''),
                topic: item.category,
                hasData: count > 0,
                count: count,
                gapReason: vm.gapText(item),
            };
        });
        this.setData({ results: results });
    },

    onInput: function (event) {
        const keyword = event.detail.value;
        this.setData({ keyword: keyword });
        this.applyFilter(keyword);
    },
    onClear: function () {
        this.setData({ keyword: '' });
        this.applyFilter('');
    },
    onItemTap: function (event) {
        wx.navigateTo({ url: '/pages/detail/detail?code=' + event.currentTarget.dataset.code });
    },
    onRetry: function () { this.load(); },
    onShareAppMessage: function () {
        return { title: '宏观图鉴 · 看懂十年经济数据', path: '/pages/index/index' };
    },
});
