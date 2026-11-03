// 无浏览器可跑的一致性/边界验收（A 的帧时间与视觉需在浏览器里跑）
import { PRESETS, evaluate } from "../src/physics.js";
import { colorForT, colorRepeatability } from "../src/color.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) fail++;
};

const base = { f: 0.25, crop: "lettuce", season: "summer" };
const r1 = evaluate({ ...PRESETS.P1, ...base, preset: "P1" });

// B 同源：同输入两次哈希一致；颜色可重复；hex 合法
const r2 = evaluate({ ...PRESETS.P1, ...base, preset: "P1" });
ok("B1 曲线指纹稳定", r1.hash === r2.hash, r1.hash);
ok("B2 颜色重复一致", colorRepeatability(r1.T));
ok("B3 颜色 hex 合法", /^#[0-9a-f]{6}$/.test(colorForT(r1.T).hex), colorForT(r1.T).hex);

// C 边界：冬季叶菜应不可行；夏季应可行；不可行时不给产量代价
const win = evaluate({ ...PRESETS.P1, ...base, preset: "P1", season: "winter" });
ok("C1 冬季叶菜不可行", win.feasible === false, `DLI=${win.dli.toFixed(1)}`);
ok("C2 夏季叶菜可行", r1.feasible === true, `DLI=${r1.dli.toFixed(1)}`);
ok("C3 不可行不给代价", win.cost === null);

// 单调性：f 增大 → DLI 下降；f=0 → 冠层 R:FR 回到自然值附近
const dl = [0, 0.1, 0.2, 0.3, 0.4].map((f) => evaluate({ ...PRESETS.P1, ...base, preset: "P1", f }).dli);
ok("C4 DLI 随 f 单调下降", dl.every((v, i) => i === 0 || v < dl[i - 1]), dl.map((x) => x.toFixed(1)).join(">"));
const f0 = evaluate({ ...PRESETS.P1, ...base, preset: "P1", f: 0 });
ok("C5 f=0 时 R:FR≈自然值", Math.abs(f0.rfrCanopy - 1.097) < 0.05, f0.rfrCanopy.toFixed(3));

// 预设排序：P1 富远红（FR/PAR 高）、P3 接近中性、P4 缺远红
const m = {};
for (const k of ["P1", "P3", "P4"]) {
  m[k] = evaluate({ ...PRESETS[k], ...base, preset: k });
}
ok("P1 FR/PAR > 1.5", m.P1.frpar > 1.5, m.P1.frpar.toFixed(2));
ok("P3 FR/PAR < P1", m.P3.frpar < m.P1.frpar, `${m.P3.frpar.toFixed(2)} < ${m.P1.frpar.toFixed(2)}`);
ok("P4 缺远红（FR/PAR<1）", m.P4.frpar < 1, m.P4.frpar.toFixed(2));

// D 离线：依赖均为本地路径
import { readFileSync, existsSync } from "node:fs";
const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
ok("D1 无 CDN 引用", !/https?:\/\/(?!127\.0\.0\.1)/.test(idx));
ok("D2 本地 three/echarts 存在",
  existsSync(new URL("../vendor/three.module.js", import.meta.url)) &&
  existsSync(new URL("../vendor/echarts.min.js", import.meta.url)));

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
