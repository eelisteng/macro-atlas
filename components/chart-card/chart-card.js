const chart = require('../../utils/chart');

Component({
    properties: {
        periods: { type: Array, value: [] },
        series: { type: Array, value: [] },
        mode: { type: String, value: 'line' },
        dualAxis: { type: Boolean, value: false },
        growthMode: { type: Boolean, value: false },
        sourceText: { type: String, value: '' },
        height: { type: Number, value: 220 },
        highlightIndex: { type: Number, value: -1 },
    },

    data: {
        legend: [],
    },

    observers: {
        'periods, series, mode, dualAxis, growthMode, sourceText, highlightIndex': function () {
            this.render();
        },
    },

    lifetimes: {
        attached: function () { this.render(); },
        ready: function () { this.render(); },
    },

    methods: {
        render: function (retry) {
            const that = this;
            // 组件刚挂载时 canvas 常常还没完成布局（真机比模拟器明显），
            // 按 width/height=0 画一次会留下永久空白图。这里等尺寸就绪再画。
            const gen = (this._renderGen || 0) + 1;
            this._renderGen = gen;
            const attempt = retry || 0;
            const scheduleRetry = function () {
                if (attempt >= 6) {
                    console.warn('[chart-card] canvas 尺寸未就绪，图表未绘制');
                    return;
                }
                setTimeout(function () {
                    if (gen !== that._renderGen) return; // 已被更新的属性触发的渲染取代
                    that.render(attempt + 1);
                }, 80 + attempt * 80);
            };
            wx.createSelectorQuery().in(this).select('#chart').fields({ node: true, size: true, rect: true }).exec(function (res) {
                if (gen !== that._renderGen) return;
                const info = res && res[0];
                if (!info || !info.node || !info.width || !info.height) {
                    scheduleRetry();
                    return;
                }
                that._rectLeft = info.left || 0;
                const canvas = info.node;
                const ctx = canvas.getContext('2d');
                let dpr = 2;
                try { dpr = wx.getSystemInfoSync().pixelRatio || 2; } catch (e) { dpr = 2; }
                const width = info.width;
                const height = info.height;
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                ctx.scale(dpr, dpr);
                that._canvas = canvas;
                that._width = width;
                that._height = height;
                const series = that.data.series || [];
                try {
                    that._hitAreas = chart.draw(ctx, width, height, {
                        periods: that.data.periods || [],
                        series: series,
                        mode: that.data.mode,
                        dualAxis: that.data.dualAxis,
                        growthMode: that.data.growthMode,
                        sourceText: that.data.sourceText,
                        highlightIndex: that.data.highlightIndex >= 0 ? that.data.highlightIndex : undefined,
                    });
                } catch (err) {
                    console.error('[chart-card] 图表绘制失败', err);
                    that._hitAreas = [];
                }
                const legend = series.map(function (s, i) {
                    return {
                        label: s.label,
                        color: s.color || chart.COLORS[i % chart.COLORS.length],
                        unit: s.unit || '',
                    };
                });
                that.setData({ legend: legend });
            });
        },

        onTap: function (event) {
            // tap 的 detail.x 是页面坐标，命中检测用的是画布内坐标；页面纵向滚动不影响 x。
            const x = event.detail.x - (this._rectLeft || 0);
            const areas = this._hitAreas || [];
            if (areas.length === 0) return;
            let best = null;
            let bestDistance = 26;
            areas.forEach(function (area) {
                const d = Math.abs(area.x - x);
                if (d < bestDistance) { bestDistance = d; best = area; }
            });
            if (!best) return;
            this.triggerEvent('pointtap', {
                index: best.index,
                period: best.period,
                value: best.value,
                label: best.label,
            });
        },

        // 分享长图：导出当前画布（图表内已绘制来源水印）。
        exportImage: function () {
            const that = this;
            return new Promise(function (resolve, reject) {
                if (!that._canvas) { reject(new Error('图表尚未渲染完成')); return; }
                wx.canvasToTempFilePath({
                    canvas: that._canvas,
                    success: function (res) { resolve(res.tempFilePath); },
                    fail: function (err) { reject(new Error(err.errMsg || '导出失败')); },
                }, that);
            });
        },
    },
});
