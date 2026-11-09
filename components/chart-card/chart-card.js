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
        render: function () {
            const that = this;
            wx.createSelectorQuery().in(this).select('#chart').fields({ node: true, size: true, rect: true }).exec(function (res) {
                if (!res || !res[0] || !res[0].node) return;
                const info = res[0];
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
                that._hitAreas = chart.draw(ctx, width, height, {
                    periods: that.data.periods || [],
                    series: series,
                    mode: that.data.mode,
                    dualAxis: that.data.dualAxis,
                    growthMode: that.data.growthMode,
                    sourceText: that.data.sourceText,
                    highlightIndex: that.data.highlightIndex >= 0 ? that.data.highlightIndex : undefined,
                });
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
