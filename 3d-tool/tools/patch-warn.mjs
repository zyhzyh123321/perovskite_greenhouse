import { readFileSync, writeFileSync } from "node:fs";

const p = "src/main.js";
let m = readFileSync(p, "utf8");
if (m.includes("warnchip")) {
  console.log("already patched");
  process.exit(0);
}
const anchor = "  // 作物视角：两行";
const block = `  // 范围与有效域警示（琥珀色；红色只留给数据冲突）
  const warns = [];
  if (Math.abs(Math.log(r.dli / r.dli0)) > 0.25) warns.push("超出外推域：DLI 变化 >±22%，需实测剂量-响应曲线");
  if (r.avtPh > 55) warns.push("透明度 >55%：高于常见半透明器件，属模型外推");
  if (r.avtPh < 8) warns.push("透明度 <8%：接近不透明，作物端基本无光");
  if (state.eg > 1.75) warns.push("Eg>1.75 eV：该带隙区文献样本极少，只可作方向");
  if (state.eg < 1.5) warns.push("Eg<1.5 eV：窄带隙，可见光吸收强");
  if (state.d > 320) warns.push("厚度 >320 nm：超出典型半透明器件厚度");
  if (state.f > 0.35) warns.push("覆盖比 >0.35：超出已验证部署窗口");
  $("warn").innerHTML = warns.map((w) => \`<span class="warnchip">\${w}</span>\`).join("");

  // 滑杆读数：越界变琥珀色
  const outOfRange = {
    eg: state.eg > 1.75 || state.eg < 1.5,
    d: state.d > 320,
    f: state.f > 0.35,
    w: state.w < 4,
  };
  for (const [k, o] of Object.entries(inputs)) o.out.classList.toggle("warn", !!outOfRange[k]);

`;
if (!m.includes(anchor)) throw new Error("anchor not found");
m = m.replace(anchor, block + anchor);
writeFileSync(p, m, "utf8");
console.log("patched", p);
