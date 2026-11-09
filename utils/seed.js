// 首次启动 / 手动同步时，把会话侧脚本生成的一手来源种子数据写入本 app 的云数据库。
// 数据不是本地存储：写入后页面一律从云端读取；本地只是随包的只读交付载体。
const seed = require('./seed-data');
const { cloud } = require('./cloud');

function chunks(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

async function ensureSeeded(force) {
    const existing = await cloud.database.from('indicators').select('id, code').limit(200);
    if (existing.error) return { inserted: 0, error: existing.error.message || '指标字典读取失败', skipped: false };

    const byCode = {};
    (existing.data || []).forEach(function (row) { byCode[row.code] = row.id; });

    if (Object.keys(byCode).length === 0) {
        const indicatorRows = seed.indicators.map(function (item) {
            return {
                code: item.code, name: item.name, alias: item.alias,
                category: item.category, region: item.region, unit: item.unit,
                frequency: item.frequency, value_type: item.value_type,
                caliber: item.caliber, default_chart: item.default_chart,
                source_name: item.source_name, source_url: item.source_url,
                comparable_group: item.comparable_group,
                importance: item.importance, sort_order: item.sort_order,
                is_custom: false,
            };
        });
        const inserted = await cloud.database.from('indicators').insert(indicatorRows).select('id, code');
        if (inserted.error) return { inserted: 0, error: inserted.error.message || '指标字典写入失败', skipped: false };
        (inserted.data || []).forEach(function (row) { byCode[row.code] = row.id; });
    }

    if (!force) {
        const count = await cloud.database.from('data_points').select('id', { count: 'exact', head: true });
        if (!count.error && (count.count || 0) > 0) {
            return { inserted: 0, error: '', skipped: true };
        }
    }

    const spec = {};
    seed.spec.forEach(function (item) { spec[item.k] = item; });
    const rows = seed.rows.map(function (row) {
        const meta = spec[row[0]];
        if (!meta || !byCode[meta.code]) return null;
        return {
            indicator_id: byCode[meta.code],
            period: row[1],
            period_type: meta.freq,
            value: Number(row[2]),
            unit: meta.unit,
            caliber: meta.caliber,
            source: seed.source,
            source_url: seed.sourceUrl,
            release_date: '',
            revision: 'final',
            is_latest: true,
            import_batch: seed.batch,
            auto_imported: true,
        };
    }).filter(function (row) { return row !== null; });

    let inserted = 0;
    const parts = chunks(rows, 60);
    for (let i = 0; i < parts.length; i += 1) {
        const result = await cloud.database
            .from('data_points')
            .upsert(parts[i], { onConflict: 'indicator_id,period,revision' });
        if (result.error) {
            return { inserted: inserted, error: result.error.message || '数据点写入失败', skipped: false };
        }
        inserted += parts[i].length;
    }

    await cloud.database.from('sync_logs').insert({
        source: '国家统计局 · 国家数据 API',
        indicator_count: seed.spec.length,
        inserted_count: inserted,
        updated_count: 0,
        failed_count: 0,
        note: seed.note,
    });

    return { inserted: inserted, error: '', skipped: false };
}

module.exports = { ensureSeeded: ensureSeeded };
