// Lists every page whose import graph reaches mock / fixture modules, grouped by mock module.
// Usage: node scripts/mock-inventory.mjs [src] [out.json]
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "src");
const OUT = process.argv[3];
const MOCK = [/\/mocks\//, /\/lib\/mock-data\.ts$/, /\/lib\/mock-api\.ts$/, /\/lib\/prowise-mock-adapters\.ts$/, /\/lib\/fixtures\//,
  /\/store\/project-store\.ts$/, /\/store\/org-console-store\.ts$/, /\/store\/delivery-store\.ts$/, /\/lib\/developer-api\.ts$/,
  /\/_store\/useSuperAdminStore\.ts$/, /\/_store\/usePlatformOperatorStore\.ts$/];
const LIVE = [/\/lib\/api\.ts$/, /\/lib\/api-client\.ts$/];
const norm = (f) => f.split(path.sep).join("/");
const cache = new Map();

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function deps(file) {
  if (cache.has(file)) return cache.get(file);
  const out = new Set();
  cache.set(file, out);
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
    const r = resolve(file, m[1] || m[2]);
    if (r) out.add(r);
  }
  return out;
}

// Shared shells (layouts, navigation, session/workspace helpers, the permission store) are inventoried separately:
// with --pages they are not traversed, so each page is classified by its own data sources.
const SHELL = [/\/components\/layouts\//, /\/components\/navigation\//, /\/lib\/workspace-switch\.ts$/, /\/lib\/session\.ts$/,
  /\/store\/permission-store\.ts$/, /\/providers\//, /\/components\/org-console\/OrgShell\.tsx$/,
  /\/components\/delivery\/DeliveryShell\.tsx$/, /\/hooks\/usePermissions\.ts$/, /\/store\/auth-store\.ts$/,
  /\/components\/owner\/OwnerAccessGate\.tsx$/, /\/components\/org-console\/OrgUI\.tsx$/,
  /\/components\/delivery\/DeliveryUI\.tsx$/];
const PAGES_MODE = process.argv.includes("--pages");

function closure(file) {
  const seen = new Set();
  const stack = [file];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (PAGES_MODE && f !== file && SHELL.some((r) => r.test(norm(f)))) continue;
    for (const d of deps(f)) stack.push(d);
  }
  return seen;
}

const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "page.tsx") pages.push(p);
  }
})(path.join(SRC, "app"));

const rows = [];
for (const p of pages) {
  const all = [...closure(p)].map(norm);
  const mocks = [...new Set(all.filter((f) => MOCK.some((r) => r.test(f))).map((f) => f.replace(/.*\/src\//, "")))];
  const live = all.some((f) => LIVE.some((r) => r.test(f)));
  const route = norm(p).replace(/.*\/src\/app/, "").replace(/\/\([^)]+\)/g, "").replace(/\/page\.tsx$/, "") || "/";
  rows.push({ route, mocks, live });
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
const byMock = {};
for (const r of rows) for (const m of r.mocks) (byMock[m] ||= []).push(r.route);
for (const [m, rs] of Object.entries(byMock).sort((a, b) => b[1].length - a[1].length)) {
  const roles = [...new Set(rs.map((r) => r.match(/^\/org\/\[orgId\]\/([^/]+)/)?.[1] ?? r.split("/")[1]))];
  console.log(`${m} | ${rs.length} pages | ${roles.join(", ")}`);
}
console.log("total pages", rows.length, "| reaching mock", rows.filter((r) => r.mocks.length).length,
  "| live-only", rows.filter((r) => !r.mocks.length && r.live).length);
