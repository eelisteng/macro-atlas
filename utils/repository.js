// 统一数据层：页面只调这里，不直接碰云 SDK，也不使用本地存储冒充持久化。
const { cloud } = require('./cloud');
const { INDICATORS } = require('./indicators');

function messageOf(error) {
    if (!error) return '';
    if (error.code === '42P01') return '数据表尚未就绪，请稍后重试';
    if (error.code === '42501') return '没有访问权限，请检查云服务配置';
    if (error.code === '23505') return '该指标同一期间已存在相同修订版本';
    return error.message || '数据加载失败';
}

function rows(data) {
    return Array.isArray(data) ? data : [];
}

// 数据库是 id 与可管理元数据的来源，本地字典补齐释义、口径、可比分组等说明文案。
async function listIndicators() {
    const local = {};
    INDICATORS.forEach(function (item) { local[item.code] = item; });
    const result = await cloud.database
        .from('indicators')
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(200);
    if (result.error) return { data: null, error: messageOf(result.error) };
    const data = rows(result.data).map(function (row) {
        const base = local[row.code] || {};
        return Object.assign({}, base, row, {
            explainer: base.explainer || row.explainer || '',
            how_to_read: base.how_to_read || row.how_to_read || '',
            related: base.related || row.related || '',
            comparable_group: base.comparable_group || row.comparable_group || '',
            gapReason: base.gapReason || '',
        });
    });
    return { data: data, error: '' };
}

async function listPoints(indicatorId, limit) {
    let query = cloud.database
        .from('data_points')
        .select('*')
        .eq('indicator_id', indicatorId)
        .order('period', { ascending: true })
        .limit(limit || 400);
    const result = await query;
    if (result.error) return { data: null, error: messageOf(result.error) };
    return { data: rows(result.data), error: '' };
}

// 速览 / 专题 / 搜索共用：分页取回全部数据点。
// 早期版本用单条 limit(600)，会把年度序列的早期年份截掉，并让搜索页的「已有 N 条」少算。
// 按 id 排序保证分页边界稳定；页面侧再按 period 自行排序，所以这里不依赖期间字符串顺序。
async function listRecentPoints(limit) {
    const size = 200;
    const cap = limit || 5000;
    const all = [];
    for (let from = 0; from < cap; from += size) {
        const take = Math.min(size, cap - from);
        const result = await cloud.database
            .from('data_points')
            .select('*')
            .order('id', { ascending: true })
            .range(from, from + take - 1);
        if (result.error) return { data: null, error: messageOf(result.error) };
        const part = rows(result.data);
        all.push.apply(all, part);
        if (part.length < take) break;
    }
    return { data: all, error: '' };
}

// 批量灌库的 823 行 updated_at 完全相同，按入库时间排序会随机落到最早的年份。
// 一手来源没有提供逐期发布日期，因此这里按数据期间倒序，呈现「最近的数据」。
async function listRecentUpdates(limit) {
    const result = await cloud.database
        .from('data_points')
        .select('*')
        .order('period', { ascending: false })
        .limit(limit || 8);
    if (result.error) return { data: null, error: messageOf(result.error) };
    return { data: rows(result.data), error: '' };
}

async function listSyncLogs(limit) {
    const result = await cloud.database
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit || 10);
    if (result.error) return { data: null, error: messageOf(result.error) };
    return { data: rows(result.data), error: '' };
}

async function countPoints() {
    const result = await cloud.database
        .from('data_points')
        .select('id', { count: 'exact', head: true });
    if (result.error) return { data: 0, error: messageOf(result.error) };
    return { data: result.count || 0, error: '' };
}

function toRow(payload) {
    const row = {};
    const fields = [
        'indicator_id', 'period', 'period_type', 'value', 'previous', 'consensus', 'revised',
        'importance', 'unit', 'caliber', 'source', 'source_url', 'release_date', 'revision',
        'is_latest', 'note', 'import_batch', 'auto_imported', 'gap_reason',
    ];
    fields.forEach(function (key) {
        if (payload[key] !== undefined && payload[key] !== '') row[key] = payload[key];
    });
    return row;
}

async function createPoint(payload) {
    const row = toRow(payload);
    if (!row.indicator_id || !row.period) return { data: null, error: '请选择指标并填写数据期间' };
    const result = await cloud.database.from('data_points').insert(row).select('*');
    if (result.error) return { data: null, error: messageOf(result.error) };
    const created = rows(result.data);
    if (created.length === 0) return { data: null, error: '写入被权限策略拦截，数据未保存' };
    return { data: created[0], error: '' };
}

async function updatePoint(id, payload) {
    const row = toRow(payload);
    if (Object.keys(row).length === 0) return { data: null, error: '没有可提交的字段' };
    const result = await cloud.database.from('data_points').update(row).eq('id', id).select('*');
    if (result.error) return { data: null, error: messageOf(result.error) };
    const updated = rows(result.data);
    if (updated.length === 0) return { data: null, error: '没有保存成功，记录可能已被删除或无权修改' };
    return { data: updated[0], error: '' };
}

async function removePoint(id) {
    const result = await cloud.database.from('data_points').delete().eq('id', id).select('id');
    if (result.error) return { data: null, error: messageOf(result.error) };
    if (rows(result.data).length === 0) return { data: null, error: '没有删除成功，记录可能已被删除或无权修改' };
    return { data: { removed: 1 }, error: '' };
}

module.exports = {
    listIndicators: listIndicators,
    listPoints: listPoints,
    listRecentPoints: listRecentPoints,
    listRecentUpdates: listRecentUpdates,
    listSyncLogs: listSyncLogs,
    countPoints: countPoints,
    createPoint: createPoint,
    updatePoint: updatePoint,
    removePoint: removePoint,
};
