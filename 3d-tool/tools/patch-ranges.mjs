import { readFileSync, writeFileSync } from "node:fs";

const p = "src/main.js";
let m = readFileSync(p, "utf8");

const reps = [
  ['{ key: "eg", label: "带隙 Eg", min: 1.45, max: 1.85, step: 0.01',
   '{ key: "eg", label: "带隙 Eg", min: 1.20, max: 2.40, step: 0.01'],
  ['{ key: "f", label: "覆盖比 f", min: 0, max: 0.6, step: 0.01',
   '{ key: "f", label: "覆盖比 f", min: 0, max: 1.0, step: 0.01'],
  ['  if (state.eg > 1.75) warns.push("Eg>1.75 eV：该带隙区文献样本极少，只可作方向");',
   '  if (state.eg > 1.90) warns.push("Eg>1.90 eV：进入叠层顶电池区，单结半透明记录极少");\n  else if (state.eg > 1.75) warns.push("Eg>1.75 eV：该带隙区文献样本极少，只可作方向");'],
  ['  if (state.f > 0.35) warns.push("覆盖比 >0.35：超出已验证部署窗口");',
   '  if (state.f > 0.35) warns.push("覆盖比 >0.35：超出已验证部署窗口");\n  if (state.f > 0.8) warns.push("覆盖比 >0.8：接近全遮盖，作物端基本无自然光");'],
  ['    eg: state.eg > 1.75 || state.eg < 1.5,', '    eg: state.eg > 1.90 || state.eg < 1.5,'],
  ['for (let i = 0; i <= 4; i++) {\n      const f = 0.05 + i * 0.075;',
   'for (let i = 0; i <= 6; i++) {\n      const f = 0.05 + i * 0.1;'],
];

for (const [a, b] of reps) {
  if (!m.includes(a)) throw new Error("not found: " + a.slice(0, 40));
  m = m.replace(a, b);
}
writeFileSync(p, m, "utf8");
console.log("ranges patched");
