const repo = require('../../utils/repository');
const seed = require('../../utils/seed');
const vm = require('../../utils/viewmodel');
const fmt = require('../../utils/format');
const { TOPICS } = require('../../utils/indicators');

Page({
    data: {
        viewState: 'loading',
        errorText: '',
        updatedAt: '—',
        indicatorCount: 0,
        pointCount: 0,
        cards: [],
        topics: TOPICS,
        recent: [],
    },

    onLoad: function () { this.load(); },
    onShow: function () { if (this._loaded) this.load(); },
    onPullDownRefresh: function () {
        const that = this;
        this.load(function () { wx.stopPullDownRefresh(); that._loaded = true; });
    },

    load: function (done) {
        const that = this;
        this.setData({ viewState: 'loading', errorText: '' });
        (async function () {
            // 首次启动把会话侧脚本生成的一手来源数据写入本 app 的云数据库；已有数据则跳过。
            // 同步失败不阻断阅读：云端已有数据时页面照常渲染，可在「我的」页手动重同步。
            const boot = await seed.ensureSeeded(false);
            if (boot.error) console.warn('内置数据同步跳过：' + boot.error);
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const indicators = ind.data || [];
            const byCode = {};
            const byId = {};
            indicators.forEach(function (item) { byCode[item.code] = item; byId[item.id] = item; });

            const recent = await repo.listRecentPoints();
            if (recent.error) throw new Error(recent.error);
            const updates = await repo.listRecentUpdates(6);
            const count = await repo.countPoints();
            const grouped = vm.rowsByIndicator(recent.data);

            const cards = vm.FEATURED.map(function (code) {
                const item = byCode[code];
                if (!item) return null;
                const rows = grouped[item.id] || [];
                const latest = rows.length > 0 ? rows[rows.length - 1] : null;
                const prev = rows.length > 1 ? rows[rows.length - 2] : null;
                return {
                    code: code,
                    name: item.name,
                    unit: item.unit,
                    freq: item.frequency === 'month' ? '月' : (item.frequency === 'quarter' ? '季' : '年'),
                    value: latest ? fmt.formatNumber(latest.value) : '—',
                    period: latest ? fmt.formatPeriod(latest.period, item.frequency) : '暂无数据',
                    delta: latest ? fmt.deltaText(latest.value, prev ? prev.value : null, item.unit) : vm.gapText(item),
                    spark: vm.sparkFromRows(rows, 12),
                    hasData: !!latest,
                    valueUnit: item.unit,
                };
            }).filter(function (x) { return x !== null; });

            const recentList = (updates.data || []).map(function (row) {
                const item = byId[row.indicator_id] || {};
                const stamp = String(row.updated_at || '').slice(0, 10);
                // 一手来源未逐期给出发布日期时，标注为「入库」，不要伪装成发布日。
                const timeText = row.release_date
                    ? ('发布 ' + row.release_date)
                    : (stamp ? '入库 ' + stamp : '发布时间未登记');
                return {
                    id: row.id,
                    code: item.code || '',
                    title: (item.name || '数据点') + ' · ' + fmt.formatPeriod(row.period, row.period_type),
                    sub: (row.source || item.source_name || '未标注来源') + ' · ' + timeText,
                    value: fmt.formatNumber(row.value) + (row.unit || item.unit || ''),
                    gap: row.value === null || row.value === undefined,
                };
            });

            let updatedAt = '—';
            if (recentList.length > 0) {
                const stamp = String((updates.data || [])[0].updated_at || '').slice(0, 10);
                if (stamp) updatedAt = stamp;
            }
            that.setData({
                viewState: 'ready',
                updatedAt: updatedAt,
                indicatorCount: indicators.length,
                pointCount: count.data || 0,
                cards: cards,
                recent: recentList,
            });
            that._loaded = true;
            if (done) done();
        })().catch(function (err) {
            that.setData({ viewState: 'error', errorText: err.message || '数据加载失败' });
            if (done) done();
        });
    },

    onRetry: function () { this.load(); },
    onCardTap: function (event) {
        wx.navigateTo({ url: '/pages/detail/detail?code=' + event.currentTarget.dataset.code });
    },
    onTopicTap: function (event) {
        wx.navigateTo({ url: '/pages/topics/topics?category=' + event.currentTarget.dataset.key });
    },
    onRecentTap: function (event) {
        const code = event.currentTarget.dataset.code;
        if (!code) return;
        wx.navigateTo({ url: '/pages/detail/detail?code=' + code });
    },
    onSearchTap: function () {
        wx.navigateTo({ url: '/pages/search/search' });
    },
    onShareAppMessage: function () {
        return { title: '宏观图鉴 · 看懂十年经济数据', path: '/pages/index/index' };
    },
});
