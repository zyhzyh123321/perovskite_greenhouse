// CIE 1931 2° 色匹配函数（Wyman 2013 分段高斯近似）与光谱→sRGB
import { AM15G } from "./spectrum_data.js";
import { LAMBDA } from "./physics.js";

const g = (l, mu, s1, s2) => {
  const s = l < mu ? s1 : s2;
  const t = (l - mu) / s;
  return Math.exp(-0.5 * t * t);
};
const xbar = (l) => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
const ybar = (l) => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
const zbar = (l) => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);

function xyzFromT(T) {
  let X = 0, Y = 0, Z = 0, Xn = 0, Yn = 0, Zn = 0;
  for (let i = 0; i < LAMBDA.length; i++) {
    const l = LAMBDA[i];
    const p = AM15G.irradiance[i];
    X += p * T[i] * xbar(l); Y += p * T[i] * ybar(l); Z += p * T[i] * zbar(l);
    Xn += p * xbar(l); Yn += p * ybar(l); Zn += p * zbar(l);
  }
  return [X / Xn, Y / Yn, Z / Zn];
}

// XYZ(D65) -> 线性 sRGB
const M = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.2040, 1.0570],
];
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function colorForT(T) {
  const [X, Y, Z] = xyzFromT(T);
  let rgb = M.map((row) => row[0] * X + row[1] * Y + row[2] * Z);
  // 色域映射：超出则朝亮度方向去饱和（保持色相）
  const mx = Math.max(...rgb), mn = Math.min(...rgb);
  if (mx > 1 || mn < 0) {
    const L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    rgb = rgb.map((c) => {
      const v = L + (c - L) * 0.72;
      return Math.min(1, Math.max(0, v));
    });
  }
  const s = rgb.map((c) => Math.round(255 * gamma(Math.min(1, Math.max(0, c)))));
  return {
    rgb: s,
    hex: "#" + s.map((v) => v.toString(16).padStart(2, "0")).join(""),
    luma: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2],
  };
}

// 同一曲线正向量两遍，用于非确定性检查
export function colorRepeatability(T) {
  return colorForT(T).hex === colorForT(T).hex;
}
