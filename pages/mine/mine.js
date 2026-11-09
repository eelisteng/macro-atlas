const repo = require('../../utils/repository');
const seed = require('../../utils/seed');
const { SOURCE_CITE } = require('../../utils/indicators');

Page({
    data: {
        viewState: 'loading',
        errorText: '',
        updatedAt: '—',
        indicatorCount: 0,
        pointCount: 0,
        syncLogs: [],
        sourceCite: SOURCE_CITE,
        resyncing: false,
        resyncMessage: '',
    },

    onShow: function () { this.load(); },

    load: function () {
        const that = this;
        this.setData({ viewState: 'loading', errorText: '' });
        (async function () {
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const count = await repo.countPoints();
            const logs = await repo.listSyncLogs(8);
            const list = (logs.data || []).map(function (row) {
                return {
                    id: row.id,
                    source: row.source,
                    when: String(row.created_at || '').slice(0, 16).replace('T', ' '),
                    text: '指标 ' + (row.indicator_count || 0) + ' 个 · 新增 ' + (row.inserted_count || 0) + ' · 更新 ' + (row.updated_count || 0) + ' · 失败 ' + (row.failed_count || 0),
                    note: row.note || '',
                };
            });
            that.setData({
                viewState: 'ready',
                indicatorCount: (ind.data || []).length,
                pointCount: count.data || 0,
                syncLogs: list,
                updatedAt: list.length > 0 ? list[0].when.slice(0, 10) : '尚无同步记录',
            });
        })().catch(function (err) {
            that.setData({ viewState: 'error', errorText: err.message || '加载失败' });
        });
    },

    onResync: function () {
        const that = this;
        if (this.data.resyncing) return;
        this.setData({ resyncing: true, resyncMessage: '正在把内置的一手来源数据写入云数据库…' });
        seed.ensureSeeded(true).then(function (result) {
            that.setData({
                resyncing: false,
                resyncMessage: result.error
                    ? '同步失败：' + result.error
                    : '同步完成，写入 ' + result.inserted + ' 个数据点（已有记录按同一期间更新）。',
            });
            that.load();
        }).catch(function (err) {
            that.setData({ resyncing: false, resyncMessage: '同步失败：' + (err.message || '未知错误') });
        });
    },
    onGoData: function () { wx.switchTab({ url: '/pages/data/data' }); },
    onGoTopics: function () { wx.switchTab({ url: '/pages/topics/topics' }); },
    onRetry: function () { this.load(); },
    onShareAppMessage: function () {
        return { title: '宏观图鉴 · 看懂十年经济数据', path: '/pages/index/index' };
    },
});
