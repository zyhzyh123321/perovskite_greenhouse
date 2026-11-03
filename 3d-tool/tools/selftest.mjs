import { PRESETS, evaluate, curveHash } from "../src/physics.js";

const base = { f: 0.25, crop: "lettuce", season: "summer" };
console.log("preset  AVTph  AVTn  FR/PAR  R:FRlocal R:FRcan  DLI   yield%  feasible");
for (const [k, p] of Object.entries(PRESETS)) {
  const r = evaluate({ ...p, ...base, preset: k });
  console.log(
    k.padEnd(6),
    r.avtPh.toFixed(1).padStart(5),
    r.avtEn.toFixed(1).padStart(5),
    r.frpar.toFixed(2).padStart(6),
    r.rfrLocal.toFixed(2).padStart(8),
    r.rfrCanopy.toFixed(2).padStart(8),
    r.dli.toFixed(1).padStart(5),
    (r.relYield * 100).toFixed(1).padStart(6),
    r.feasible
  );
}

// 一致性：同输入两次哈希一致
const s = { ...PRESETS.P1, ...base, preset: "P1" };
const a = evaluate(s), b = evaluate(s);
console.log("hash stable:", a.hash === b.hash, a.hash);
// 覆盖比单调性：f 增大 → DLI 下降
const dlis = [0, 0.1, 0.2, 0.3].map((f) => evaluate({ ...s, f }).dli);
console.log("DLI vs f:", dlis.map((x) => x.toFixed(2)).join(" > "));
