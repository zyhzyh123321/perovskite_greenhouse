// 图表：透射曲线 / Pareto 散点 / 参照对比
const FONT = "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif";
const AXIS = { color: "#8ea2ac", fontSize: 10, fontFamily: FONT };
const SPLIT = { lineStyle: { color: "#26343c" } };

export function createCharts() {
  const echarts = window.echarts;
  const t = echarts.init(document.getElementById("chartT"), null, { renderer: "canvas" });
  const p = echarts.init(document.getElementById("chartP"), null, { renderer: "canvas" });
  const b = echarts.init(document.getElementById("chartB"), null, { renderer: "canvas" });

  function resize() { t.resize(); p.resize(); b.resize(); }
  new ResizeObserver(resize).observe(document.getElementById("right"));

  function updateT(L, T, hash) {
    t.setOption({
      animation: false,
      grid: { left: 42, right: 14, top: 14, bottom: 26 },
      tooltip: {
        trigger: "axis", backgroundColor: "#0b1114", borderColor: "#26343c",
        textStyle: { color: "#e7eef1", fontSize: 11, fontFamily: FONT },
        formatter: (ps) => `${ps[0].axisValue} nm<br/>T = ${ps[0].data.toFixed(1)} %<br/><span style="color:#8ea2ac">hash ${hash}</span>`,
      },
      xAxis: {
        type: "category", data: L.map(String), boundaryGap: false,
        axisLabel: { ...AXIS, interval: 49 }, axisLine: { lineStyle: { color: "#2b3a42" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value", min: 0, max: 100, name: "T %",
        nameTextStyle: AXIS, axisLabel: { ...AXIS, interval: 25 },
        splitLine: SPLIT, axisLine: { show: false },
      },
      series: [{
        type: "line", data: T.map((v) => +(v * 100).toFixed(1)), symbol: "none",
        lineStyle: { width: 1.6, color: "#37b0c9" },
        areaStyle: { color: "rgba(55,176,201,.12)" },
        markArea: {
          silent: true, label: { show: false },
          data: [
            [{ xAxis: 127, itemStyle: { color: "rgba(217,161,59,.13)" } }, { xAxis: 133 }],
            [{ xAxis: 162, itemStyle: { color: "rgba(201,120,90,.13)" } }, { xAxis: 167 }],
          ],
        },
      }],
    });
  }

  function updateP(points, current, hash) {
    const feas = points.filter((d) => d.feasible), inf = points.filter((d) => !d.feasible);
    p.setOption({
      animation: false,
      grid: { left: 52, right: 16, top: 16, bottom: 30 },
      tooltip: {
        backgroundColor: "#0b1114", borderColor: "#26343c",
        textStyle: { color: "#e7eef1", fontSize: 11, fontFamily: FONT },
        formatter: (o) => {
          const d = o.data;
          return `${d.preset} · f=${d.f}<br/>发电 ${d.gen.toFixed(0)} kWh·m⁻²·yr⁻¹<br/>` +
            (d.feasible ? `代价 ${d.cost.toFixed(1)} %/kWh` : "不可行（无代价数值）");
        },
      },
      xAxis: {
        type: "value", name: "年发电量 kWh·m⁻²·yr⁻¹", nameTextStyle: AXIS,
        axisLabel: AXIS, splitLine: SPLIT, axisLine: { lineStyle: { color: "#2b3a42" } },
      },
      yAxis: {
        type: "value", name: "作物代价 % / kWh", nameTextStyle: AXIS,
        axisLabel: AXIS, splitLine: SPLIT, axisLine: { show: false },
      },
      series: [
        {
          type: "scatter", name: "可行", data: feas.map((d) => ({ ...d, value: [d.gen, d.cost] })),
          symbolSize: 7, itemStyle: { color: "rgba(55,176,201,.75)" },
        },
        {
          type: "scatter", name: "不可行", data: [],
          symbolSize: 7, itemStyle: { color: "transparent", borderColor: "#6b7880", borderWidth: 1 },
        },
        {
          type: "effectScatter", name: "当前", data: [{ ...current, value: [current.gen, current.cost] }],
          symbolSize: 13, showEffectOn: "render", rippleEffect: { scale: 2.4, brushType: "stroke" },
          itemStyle: { color: "#d9a13b", shadowBlur: 8, shadowColor: "#d9a13b" },
          tooltip: { formatter: () => `当前 · hash ${hash}` },
        },
      ],
    });
  }

  function updateB(cats, current, ref) {
    b.setOption({
      animation: false,
      grid: { left: 76, right: 16, top: 12, bottom: 26 },
      tooltip: { trigger: "axis", backgroundColor: "#0b1114", borderColor: "#26343c",
        textStyle: { color: "#e7eef1", fontSize: 11, fontFamily: FONT } },
      legend: { top: 0, right: 0, itemWidth: 8, itemHeight: 8,
        textStyle: { color: "#8ea2ac", fontSize: 10, fontFamily: FONT } },
      xAxis: { type: "value", axisLabel: AXIS, splitLine: SPLIT, axisLine: { show: false } },
      yAxis: { type: "category", data: cats, axisLabel: AXIS, axisLine: { show: false }, axisTick: { show: false } },
      series: [
        { name: "当前方案", type: "bar", data: current, barWidth: 9,
          itemStyle: { color: "#37b0c9", borderRadius: [0, 3, 3, 0] } },
        { name: "空白玻璃", type: "bar", data: ref, barWidth: 9,
          itemStyle: { color: "#4c5b63", borderRadius: [0, 3, 3, 0] } },
      ],
    });
  }

  return { updateT, updateP, updateB, resize };
}
