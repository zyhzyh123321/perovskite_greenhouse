// 打包成单文件 HTML：双击即开（file://），无需本地服务
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => s.replace(/<\/script/gi, "<\\/script");

let html = readFileSync(resolve(root, "index.html"), "utf8");
const echarts = esc(readFileSync(resolve(root, "vendor/echarts.min.js"), "utf8"));
const app = esc(readFileSync(resolve(root, "dist/app.js"), "utf8"));

// 用函数替换，避免 $& / $' 等被当成替换模式
html = html
  .replace(/<script src="\.\/vendor\/echarts\.min\.js"><\/script>\s*/i, () => "")
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/i, () => "")
  .replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/i, () => "")
  .replace(/<title>([^<]*)<\/title>/i, (_m, t) => `<title>${t} · 单文件版</title>`);

const inject =
  `<script>${echarts}</script>\n<script>${app}</script>\n` +
  `<div style="position:fixed;left:12px;bottom:6px;font-size:10px;color:#5d6f78">单文件离线版 · 双击即可打开</div>\n`;

html = html.replace("</body>", () => inject + "</body>");

mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/greenhouse-single.html"), html, "utf8");
console.log("built dist/greenhouse-single.html", (html.length / 1024).toFixed(0) + " KB");
