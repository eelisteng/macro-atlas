const repo = require('../../utils/repository');
const fmt = require('../../utils/format');
const vm = require('../../utils/viewmodel');

var REVISIONS = ['终值', '初值', '修订'];
var REVISION_VALUES = ['final', 'initial', 'revised'];

function emptyForm() {
    return {
        period: '', value: '', previous: '', consensus: '', revised: '',
        source: '', release_date: '', note: '', caliber: '', unit: '',
        gap_reason: '', importance: '2', revision: 'final',
    };
}

function validPeriod(period, frequency) {
    if (frequency === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
    if (frequency === 'quarter') return /^\d{4}Q[1-4]$/.test(period);
    return /^\d{4}$/.test(period);
}

Page({
    data: {
        viewState: 'loading',
        errorText: '',
        indicatorNames: [],
        indicatorIndex: 0,
        selected: null,
        rows: [],
        showForm: false,
        editingId: null,
        form: emptyForm(),
        formError: '',
        saving: false,
        revisions: REVISIONS,
        revisionIndex: 0,
        periodHint: '例如 2025',
    },

    onLoad: function (options) {
        this._code = (options && options.code) || '';
        this.load();
    },

    load: function () {
        const that = this;
        this.setData({ viewState: 'loading', errorText: '' });
        (async function () {
            const ind = await repo.listIndicators();
            if (ind.error) throw new Error(ind.error);
            const list = ind.data || [];
            if (list.length === 0) throw new Error('指标字典为空，请先完成灌库');
            let index = 0;
            if (that._code) {
                list.forEach(function (item, i) { if (item.code === that._code) index = i; });
            }
            that._indicators = list;
            that.setData({
                viewState: 'ready',
                indicatorNames: list.map(function (x) { return x.name + '（' + x.code + '）'; }),
                indicatorIndex: index,
                selected: list[index],
            });
            await that.loadRows();
        })().catch(function (err) {
            that.setData({ viewState: 'error', errorText: err.message || '数据加载失败' });
        });
    },

    loadRows: function () {
        const that = this;
        const selected = this.data.selected;
        if (!selected) return Promise.resolve();
        return repo.listPoints(selected.id, 500).then(function (res) {
            if (res.error) { that.setData({ errorText: res.error }); return; }
            const raw = res.data || [];
            that._rawRows = raw;
            const rows = raw.slice().sort(function (a, b) { return fmt.periodRank(b.period) - fmt.periodRank(a.period); }).map(function (r) {
                const value = fmt.toNumber(r.value);
                const consensus = fmt.toNumber(r.consensus);
                let surprise = '';
                if (value !== null && consensus !== null) {
                    const diff = value - consensus;
                    surprise = diff > 0 ? '超预期' : (diff < 0 ? '不及预期' : '符合预期');
                }
                return {
                    id: r.id,
                    period: fmt.formatPeriod(r.period, r.period_type),
                    value: fmt.formatNumber(r.value) + (r.unit || selected.unit || ''),
                    caliber: r.caliber || selected.caliber || '未标注',
                    source: r.source || selected.source_name || '未标注',
                    badge: vm.revisionBadge(r),
                    surprise: surprise,
                    gap: value === null,
                    gapReason: r.gap_reason || '',
                };
            });
            that.setData({ rows: rows });
        });
    },

    onPick: function (event) {
        const index = Number(event.detail.value);
        const selected = this._indicators[index];
        const hint = selected.frequency === 'month' ? '例如 2026-09' : (selected.frequency === 'quarter' ? '例如 2026Q3' : '例如 2025');
        this.setData({
            indicatorIndex: index,
            selected: selected,
            showForm: false,
            periodHint: hint,
        });
        this.loadRows();
    },

    onAdd: function () {
        const selected = this.data.selected;
        this.setData({
            showForm: true,
            editingId: null,
            formError: '',
            revisionIndex: 0,
            form: Object.assign(emptyForm(), {
                source: selected.source_name || '',
                caliber: selected.caliber || '',
                unit: selected.unit || '',
            }),
        });
    },

    onEdit: function (event) {
        const id = event.currentTarget.dataset.id;
        const row = (this._rawRows || []).filter(function (r) { return String(r.id) === String(id); })[0];
        if (!row) return;
        const ri = REVISION_VALUES.indexOf(row.revision || 'final');
        this.setData({
            showForm: true,
            editingId: row.id,
            formError: '',
            revisionIndex: ri >= 0 ? ri : 0,
            form: {
                period: row.period || '',
                value: row.value === null ? '' : String(row.value),
                previous: row.previous === null || row.previous === undefined ? '' : String(row.previous),
                consensus: row.consensus === null || row.consensus === undefined ? '' : String(row.consensus),
                revised: row.revised === null || row.revised === undefined ? '' : String(row.revised),
                source: row.source || '',
                release_date: row.release_date || '',
                note: row.note || '',
                caliber: row.caliber || '',
                unit: row.unit || '',
                gap_reason: row.gap_reason || '',
                importance: String(row.importance || 2),
                revision: row.revision || 'final',
            },
        });
    },

    onDelete: function (event) {
        const that = this;
        const id = event.currentTarget.dataset.id;
        wx.showModal({
            title: '删除这条数据？',
            content: '删除后不可恢复。修订记录建议保留，而不是直接删除。',
            success: function (res) {
                if (!res.confirm) return;
                repo.removePoint(id).then(function (result) {
                    if (result.error) { wx.showToast({ title: result.error, icon: 'none' }); return; }
                    wx.showToast({ title: '已删除', icon: 'success' });
                    that.loadRows();
                });
            },
        });
    },

    onFormInput: function (event) {
        const field = event.currentTarget.dataset.field;
        const form = Object.assign({}, this.data.form);
        form[field] = event.detail.value;
        this.setData({ form: form, formError: '' });
    },

    onRevisionPick: function (event) {
        const index = Number(event.detail.value);
        const form = Object.assign({}, this.data.form, { revision: REVISION_VALUES[index] || 'final' });
        this.setData({ revisionIndex: index, form: form });
    },

    onCancel: function () { this.setData({ showForm: false, formError: '' }); },

    onSubmit: function () {
        const that = this;
        const selected = this.data.selected;
        const form = this.data.form;
        if (!validPeriod(form.period, selected.frequency)) {
            this.setData({ formError: '数据期间格式不正确，' + this.data.periodHint });
            return;
        }
        if (form.value !== '' && !Number.isFinite(Number(form.value))) {
            this.setData({ formError: '数值必须是数字；确实没有数值请留空并填写缺口原因' });
            return;
        }
        if (form.value === '' && !form.gap_reason) {
            this.setData({ formError: '数值留空时必须填写数据缺口原因' });
            return;
        }
        const payload = {
            indicator_id: selected.id,
            period: form.period,
            period_type: selected.frequency,
            unit: form.unit || selected.unit,
            caliber: form.caliber || selected.caliber,
            source: form.source || selected.source_name,
            source_url: selected.source_url || '',
            release_date: form.release_date,
            note: form.note,
            gap_reason: form.gap_reason,
            importance: Number(form.importance) || 2,
            revision: form.revision || 'final',
            is_latest: true,
            auto_imported: false,
            import_batch: 'manual',
        };
        if (form.value !== '') payload.value = Number(form.value);
        if (form.previous !== '') payload.previous = Number(form.previous);
        if (form.consensus !== '') payload.consensus = Number(form.consensus);
        if (form.revised !== '') payload.revised = Number(form.revised);

        this.setData({ saving: true, formError: '' });
        const task = this.data.editingId
            ? repo.updatePoint(this.data.editingId, payload)
            : repo.createPoint(payload);
        task.then(function (result) {
            that.setData({ saving: false });
            if (result.error) { that.setData({ formError: result.error }); return; }
            that.setData({ showForm: false, editingId: null });
            wx.showToast({ title: '已保存到云端', icon: 'success' });
            that.loadRows();
        });
    },

    onSearchTap: function () { wx.navigateTo({ url: '/pages/search/search' }); },
    onRetry: function () { this.load(); },
    onShareAppMessage: function () {
        return { title: '宏观图鉴 · 看懂十年经济数据', path: '/pages/index/index' };
    },
});
