// 物理核：纯函数，可在 Node 与浏览器中运行
import { AM15G } from "./spectrum_data.js";

export const LAMBDA0 = AM15G.lambda0;
export const STEP = AM15G.step;
export const N = AM15G.irradiance.length; // 201
export const LAMBDA = Array.from({ length: N }, (_, i) => LAMBDA0 + i * STEP);

// 太阳光谱：辐照度 -> 相对光子通量（Φ ∝ E·λ）
const PHI = AM15G.irradiance.map((e, i) => e * LAMBDA[i]);
const PAR = LAMBDA.map((l) => l >= 400 && l < 700);
const FR = LAMBDA.map((l) => l >= 700 && l <= 800);
const RW = LAMBDA.map((l) => l >= 655 && l <= 665);
const FW = LAMBDA.map((l) => l >= 725 && l <= 735);

const sumBy = (arr, mask) => arr.reduce((s, v, i) => (mask[i] ? s + v : s), 0);
export const PHI_PAR = sumBy(PHI, PAR);
export const PHI_FR = sumBy(PHI, FR);
export const PHI_R = sumBy(PHI, RW);
export const PHI_RFR = sumBy(PHI, FW);

export const MODE = {
  A: 0.012,        // 吸收强度 1/nm
  SHIFT: 92,       // 薄膜带边蓝移 nm
  WEDGE: 18,       // 吸收边宽度 nm
  V0: 0.96,        // 可见平台
  NIR_CENTER: 750, // 第二层截止中心
};

const sigmoid = (x, w) => 0.5 * (1 + Math.tanh(x / Math.max(w, 1)));

/** 生成透射曲线：400–800 nm，201 点 */
export function buildCurve({ eg, d, nir = 0, w = 20, nirCenter = MODE.NIR_CENTER }) {
  const edge = 1240 / eg - MODE.SHIFT;
  const T = new Array(N);
  for (let i = 0; i < N; i++) {
    const l = LAMBDA[i];
    const env = MODE.V0 * (1 - 0.08 * sigmoid(l - 900, 150));
    const cut = 1 - nir * sigmoid(l - nirCenter, w);
    const alpha = MODE.A / (1 + Math.exp((l - edge) / MODE.WEDGE));
    T[i] = Math.max(0, env * cut * Math.exp(-alpha * d));
  }
  return T;
}

/** 由曲线算全部无机指标 */
export function spectrumMetrics(T, { f = 0.25, dli0 = 28 } = {}) {
  const TPHI = T.map((t, i) => t * PHI[i]);
  const avtPh = (sumBy(TPHI, PAR) / PHI_PAR) * 100;
  const avtEn = (() => {
    let num = 0, den = 0;
    for (let i = 0; i < N; i++) {
      if (!PAR[i]) continue;
      num += T[i] * AM15G.irradiance[i];
      den += AM15G.irradiance[i];
    }
    return (num / den) * 100;
  })();
  const frpar = sumBy(TPHI, FR) / sumBy(TPHI, PAR) / (PHI_FR / PHI_PAR);
  const rfrLocal = sumBy(TPHI, RW) / sumBy(TPHI, FW) / (PHI_R / PHI_RFR) * 1.097;
  // 冠层混合：覆盖面积 f 的上方光 + 未覆盖的 1-f
  const mix = (mask) => f * sumBy(TPHI, mask) + (1 - f) * sumBy(PHI, mask);
  const rfrCanopy = (mix(RW) / mix(FW)) / (PHI_R / PHI_RFR) * 1.097;
  const parTrans = sumBy(TPHI, PAR) / PHI_PAR;
  const dli = dli0 * (1 - f * (1 - parTrans));
  const pss = (rf) => 0.721 + 0.0914 * Math.log(Math.max(rf, 1e-3));
  return {
    avtPh, avtEn, frpar, rfrLocal, rfrCanopy, parTrans, dli,
    pssLocal: pss(rfrLocal), pssCanopy: pss(rfrCanopy),
    neutralDev: frpar, // 光谱中性偏差：1.0 为中性
  };
}

/** 轻量哈希：曲线指纹（浏览器与 Node 通用） */
export function curveHash(T) {
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  for (let i = 0; i < T.length; i++) {
    const v = Math.round(T[i] * 1e4) & 0xffff;
    h1 = (h1 ^ v) * 16777619 >>> 0;
    h2 = (h2 ^ ((v >>> 8) | (v << 8))) * 16777619 >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
}

export const CROPS = {
  lettuce: { name: "生菜（叶菜）", eps: 0.95, dliMin: 12, price: 6 },
  tomato: { name: "番茄（果菜）", eps: 0.6, dliMin: 15, price: 5 },
  pepper: { name: "甜椒（果菜）", eps: 0.6, dliMin: 15, price: 7 },
};

export const SEASONS = { summer: { dli0: 28, label: "夏季" }, winter: { dli0: 10, label: "冬季" } };

/** 预设：全部为参数化近似，非实测 */
export const PRESETS = {
  P1: { label: "P1 高效", eg: 1.55, d: 100, nir: 0.0, w: 20, pce: 9.26, pceSrc: "Adv. Mater. 2026", gate: "ok" },
  P2: { label: "P2 高透", eg: 1.55, d: 60, nir: 0.0, w: 20, pce: null, pceSrc: "无实测", gate: "ok" },
  P4: { label: "P4 叠层", eg: 1.70, d: 196, nir: 0.85, w: 20, nirCenter: 700, pce: 17.1, pceSrc: "Nat. Commun. 2026（认证）", gate: "out_of_gate" },
  P5: { label: "P5 中性（可制造）", eg: 1.60, d: 157, nir: 0.72, w: 30, nirCenter: 712, pce: null, pceSrc: "无实测", gate: "ok" },
  P3: { label: "P3 理想中性（参考线，不可制造）", eg: 1.60, d: 157, nir: 0.80, w: 5, nirCenter: 705, pce: null, pceSrc: "无实测", gate: "reference" },
};

/** 完整评估：输入状态，输出所有派生量与证据记录 */
export function evaluate(s) {
  const T = buildCurve(s);
  const m = spectrumMetrics(T, s);
  const crop = CROPS[s.crop] || CROPS.lettuce;
  const season = SEASONS[s.season] || SEASONS.summer;
  const dli0 = season.dli0;
  const dli = dli0 * (1 - s.f * (1 - m.parTrans));
  const feasible = dli >= crop.dliMin;
  const relYield = Math.pow(dli / dli0, crop.eps);
  const pce = s.pce !== undefined ? s.pce : (PRESETS[s.preset]?.pce ?? null);
  const H = 1400, PR = 0.8;
  const gen = pce == null ? null : s.f * (pce / 100) * H * PR;
  const cost = gen && gen > 0 && feasible ? (1 - relYield) * 100 / gen : null;
  const feasibleFlag = feasible ? "feasible" : "infeasible";
  const gateFlag = PRESETS[s.preset]?.gate === "out_of_gate" ? "out_of_gate" : "ok";
  return {
    T, ...m, dli0, dli, feasible, feasibleFlag, gateFlag,
    relYield, gen, cost, crop, season, pce,
    hash: curveHash(T),
  };
}
