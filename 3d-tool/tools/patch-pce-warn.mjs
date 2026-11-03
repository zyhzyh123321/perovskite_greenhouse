import { readFileSync, writeFileSync } from "node:fs";
const p = "src/main.js";
let m = readFileSync(p, "utf8");
const needle = '  if (state.f > 0.35) warns.push("覆盖比 >0.35：超出已验证部署窗口");';
if (!m.includes("效率沿用最近预设")) {
  m = m.replace(needle, '  if (state.preset === "custom") warns.push("效率沿用最近预设，未随新参数重算");\n' + needle);
  writeFileSync(p, m, "utf8");
  console.log("pce warning added");
} else {
  console.log("already there");
}
