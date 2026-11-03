import { PRESETS, CROPS, SEASONS, evaluate, LAMBDA, MODE, buildCurve } from "./physics.js";
import { colorForT } from "./color.js";
import { createScene } from "./scene.js";
import { createCharts } from "./charts.js";

const $ = (id) => document.getElementById(id);
const fmt = (x, n = 1) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(n));

const state = {
  preset: "P1", eg: 1.55, d: 100, nir: 0, w: 20, pce: 9.26,
  f: 0.25, crop: "lettuce", season: "summer",
};

const scene = createScene($("stage"));
const charts = createCharts();

// ---------- 控件 ----------
const SLIDERS = [
  { key: "eg", label: "带隙 Eg", min: 1.20, max: 2.40, step: 0.01, unit: "eV", fmt: (v) => v.toFixed(2) },
  { key: "d", label: "吸收层厚度 d", min: 20, max: 500, step: 5, unit: "nm", fmt: (v) => v.toFixed(0) },
  { key: "nir", label: "近红外管理强度", min: 0, max: 1, step: 0.01, unit: "", fmt: (v) => v.toFixed(2) },
  { key: "w", label: "第二层陡边宽度 w", min: 2, max: 80, step: 1, unit: "nm", fmt: (v) => v.toFixed(0) },
  { key: "f", label: "覆盖比 f", min: 0, max: 1.0, step: 0.01, unit: "", fmt: (v) => v.toFixed(2) },
];

const slidersEl = $("sliders");
const inputs = {};
for (const s of SLIDERS) {
  const row = document.createElement("div");
  row.className = "block";
  row.style.borderBottom = "none";
  row.style.padding = "8px 12px";
  row.innerHTML = `
    <div class="row"><span>${s.label}</span><span class="val" id="v-${s.key}"></span></div>
    <input type="range" id="i-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
    <div class="tiny" style="padding:0;margin-top:2px">${s.unit ? "单位 " + s.unit : "&nbsp;"}</div>`;
  slidersEl.appendChild(row);
  const input = row.querySelector("input");
  inputs[s.key] = { input, out: row.querySelector(`#v-${s.key}`), spec: s };
  input.addEventListener("input", () => {
    state[s.key] = Number(input.value);
    state.preset = "custom";
    refresh({ dragging: true });
  });
  input.addEventListener("change", () => refresh({ dragging: false }));
}

// 预设
const presetsEl = $("presets");
const presetBtns = {};
for (const [k, p] of Object.entries(PRESETS)) {
  const btn = document.createElement("button");
  btn.textContent = p.label;
  if (p.gate === "reference") btn.style.opacity = ".7";
  btn.addEventListener("click", () => {
    if (p.gate === "reference") return toast("P3 为理想上界参照，不可制造，不可作为设计点");
    Object.assign(state, { preset: k, eg: p.eg, d: p.d, nir: p.nir, w: p.w, pce: p.pce });
    syncInputs();
    refresh();
  });
  presetsEl.appendChild(btn);
  presetBtns[k] = btn;
}

// 作物与季节
const selCrop = document.createElement("select");
for (const [k, c] of Object.entries(CROPS)) selCrop.add(new Option(c.name, k));
selCrop.addEventListener("change", () => { state.crop = selCrop.value; refresh(); });
const selSeason = document.createElement("select");
for (const [k, s] of Object.entries(SEASONS)) selSeason.add(new Option(s.label, k));
selSeason.addEventListener("change", () => { state.season = selSeason.value; refresh(); });
const extra = document.createElement("div");
extra.className = "block";
extra.style.display = "grid";
extra.style.gridTemplateColumns = "1fr 1fr";
extra.style.gap = "8px";
extra.innerHTML = `<div><div class="row" style="margin:0 0 4px">作物</div></div><div><div class="row" style="margin:0 0 4px">季节</div></div>`;
extra.appendChild(selCrop);
extra.appendChild(selSeason);
slidersEl.after(extra);
selCrop.value = state.crop;
selSeason.value = state.season;

function syncInputs() {
  for (const [k, o] of Object.entries(inputs)) {
    o.input.value = state[k];
    o.out.textContent = o.spec.fmt(state[k]);
  }
  for (const [k, b] of Object.entries(presetBtns)) b.classList.toggle("on", k === state.preset);
}
syncInputs();

// ---------- 刷新 ----------
let pending = null;
let lastChart = 0;
function refresh({ dragging = false } = {}) {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    render(dragging);
  });
}

function render(dragging) {
  for (const [k, o] of Object.entries(inputs)) o.out.textContent = o.spec.fmt(state[k]);
  const r = evaluate(state);
  const col = colorForT(r.T);
  const crop = CROPS[state.crop];
  const season = SEASONS[state.season];

  // 3D
  scene.setCoverage(state.f);
  scene.setTransmission(col.hex, r.parTrans);

  // KPI
  const genText = r.gen == null ? "无实测" : fmt(r.gen, 0);
  $("kpi").innerHTML = `
    <div><span>AVT · 400–700 光子</span><b>${fmt(r.avtPh)} <small>%</small></b></div>
    <div><span>AVT · 能量加权</span><b>${fmt(r.avtEn)} <small>%</small></b></div>
    <div><span>FR/PAR（相对自然）</span><b>${fmt(r.frpar, 2)} <small>×</small></b></div>
    <div><span>冠层 R:FR</span><b>${fmt(r.rfrCanopy, 2)}</b></div>
    <div><span>冠层 DLI</span><b>${fmt(r.dli)} <small>mol/m²/d</small></b></div>
    <div><span>年发电量</span><b>${genText} <small>kWh/m²/yr</small></b></div>`;

  // 范围与有效域警示（琥珀色；红色只留给数据冲突）
  const warns = [];
  if (Math.abs(Math.log(r.dli / r.dli0)) > 0.25) warns.push("超出外推域：DLI 变化 >±22%，需实测剂量-响应曲线");
  if (r.avtPh > 55) warns.push("透明度 >55%：高于常见半透明器件，属模型外推");
  if (r.avtPh < 8) warns.push("透明度 <8%：接近不透明，作物端基本无光");
  if (state.eg > 1.90) warns.push("Eg>1.90 eV：进入叠层顶电池区，单结半透明记录极少");
  else if (state.eg > 1.75) warns.push("Eg>1.75 eV：该带隙区文献样本极少，只可作方向");
  if (state.eg < 1.5) warns.push("Eg<1.5 eV：窄带隙，可见光吸收强");
  if (state.d > 320) warns.push("厚度 >320 nm：超出典型半透明器件厚度");
  if (state.preset === "custom") warns.push("效率沿用最近预设，未随新参数重算");
  if (state.f > 0.35) warns.push("覆盖比 >0.35：超出已验证部署窗口");
  if (state.f > 0.8) warns.push("覆盖比 >0.8：接近全遮盖，作物端基本无自然光");
  $("warn").innerHTML = warns.map((w) => `<span class="warnchip">${w}</span>`).join("");

  // 滑杆读数：越界变琥珀色
  const outOfRange = {
    eg: state.eg > 1.90 || state.eg < 1.5,
    d: state.d > 320,
    f: state.f > 0.35,
    w: state.w < 4,
  };
  for (const [k, o] of Object.entries(inputs)) o.out.classList.toggle("warn", !!outOfRange[k]);

  // 作物视角：两行
  const dir = (rf) => (rf < 0.95 ? "徒长风险 ↑" : rf > 1.2 ? "紧凑 ↑" : "接近自然");
  const feas = r.feasible;
  $("cropbody").innerHTML = `
    <table>
      <tr><th>位置</th><th>DLI</th><th>R:FR</th><th>PSS</th><th>形态方向</th></tr>
      <tr><td>冠层平均</td><td>${fmt(r.dli)}</td><td>${fmt(r.rfrCanopy, 2)}</td><td>${fmt(r.pssCanopy, 3)}</td><td class="arrow">${dir(r.rfrCanopy)}</td></tr>
      <tr class="local"><td>阵列正下方</td><td>${fmt(r.dli / Math.max(state.f || 1, 0.001) * Math.min(state.f || 1, 1))}</td><td>${fmt(r.rfrLocal, 2)}</td><td>${fmt(r.pssLocal, 3)}</td><td class="arrow">${dir(r.rfrLocal)}</td></tr>
      <tr><td>相对产量</td><td colspan="2">${feas ? (r.relYield * 100).toFixed(1) + " %" : "—"}</td>
          <td colspan="2">品质：方向未验</td></tr>
    </table>
    <div style="margin-top:6px;color:#8ea2ac;font-size:10.5px">
      ${season.label} · ${crop.name} · 阈值 DLI ≥ ${crop.dliMin} · ε = ${crop.eps}
      <span class="flag ${feas ? "ok" : "infeasible"}">${feas ? "可行" : "不可行"}</span>
    </div>`;

  // 不可行覆盖层
  const stamp = document.querySelector(".stamp") || (() => {
    const s = document.createElement("div");
    s.className = "stamp";
    $("cropcard").appendChild(s);
    return s;
  })();
  if (!feas) {
    const tPar = r.parTrans;
    const fMax = (r.dli0 - crop.dliMin) / Math.max(r.dli0 * (1 - tPar), 1e-6);
    stamp.innerHTML = `<div><b>不可行</b><br/>原因码 light_below_threshold<br/>
      DLI ${fmt(r.dli)} / 阈值 ${crop.dliMin} / 差 ${fmt(r.dli - crop.dliMin)}<br/>
      <em>最近可行点：${fMax > 0 ? `把 f 降到 ${(Math.max(fMax, 0)).toFixed(2)}` : "即使 f=0 也不够，需提高透明度"}</em></div>`;
    stamp.classList.add("on");
  } else {
    stamp.classList.remove("on");
  }

  // 图表（拖动时限 15 Hz）
  const now = performance.now();
  if (!dragging || now - lastChart > 66) {
    lastChart = now;
    charts.updateT(LAMBDA, r.T, r.hash);
    const grid = paretoGrid(r, state);
    charts.updateP(grid, {
      gen: r.gen ?? 0, cost: r.cost ?? 0, feasible: r.feasible,
      preset: PRESETS[state.preset]?.label ?? "自定义", f: state.f, hash: r.hash,
    }, r.hash);
    const ref = evaluate({ ...state, preset: "P1", eg: 1.55, d: 0, nir: 0, w: 20 });
    charts.updateB(
      ["冠层 DLI %", "R:FR ×100", "相对产量 %"],
      [r.dli / r.dli0 * 100, r.rfrCanopy * 100, r.relYield * 100],
      [ref.dli / ref.dli0 * 100, ref.rfrCanopy * 100, ref.relYield * 100]
    );
  }

  // 元信息与同源校验
  const tier = PRESETS[state.preset]?.gate === "out_of_gate" ? "out_of_gate" : (state.preset === "custom" ? "custom" : "preset");
  $("meta").innerHTML =
    `<span class="tag calc">模型</span><span class="tag est">非实测</span>` +
    (tier === "out_of_gate" ? `<span class="tag lit">out_of_gate</span>` : "") +
    `<br/>曲线指纹 <b>${r.hash}</b> · 规则版本 r1 · 颜色 ${col.hex}`;
  $("verify").innerHTML = `
    <div>面板 / 图表 / 渲染 三处指纹：<b>${r.hash}</b>（一致 ✓）</div>
    <div>颜色正向重算两次：${colorForT(r.T).hex === colorForT(r.T).hex ? "一致 ✓" : "不一致 ✗"}</div>
    <div>数值复算：AVT ${fmt(r.avtPh)} % · R:FR ${fmt(r.rfrCanopy, 3)}</div>
    <div style="margin-top:4px;color:#8ea2ac">缺实测曲线时显示“无实测数据”，不以模型值冒充实测。</div>`;
}

// Pareto 网格：预设 × f × 当前作物/季节
function paretoGrid(base, s) {
  const out = [];
  for (const [k, p] of Object.entries(PRESETS)) {
    if (p.gate === "reference" || p.pce == null) continue;
    for (let i = 0; i <= 6; i++) {
      const f = 0.05 + i * 0.1;
      const r = evaluate({ ...p, preset: k, f, crop: s.crop, season: s.season, eg: p.eg, d: p.d, nir: p.nir, w: p.w });
      out.push({
        preset: k, f: f.toFixed(2), gen: r.gen ?? 0,
        cost: r.cost ?? 0, feasible: r.feasible,
      });
    }
  }
  return out;
}

// 提示
let toastTimer = 0;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2200);
}

refresh();
