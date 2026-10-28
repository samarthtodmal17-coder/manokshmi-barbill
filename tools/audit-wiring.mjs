// Static wiring audit: finds buttons / data-attributes / ids that are used in one place but never connected in another.
import fs from 'fs';
const html = fs.readFileSync(process.argv[2] || 'www/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.reduce((a, b) => b.length > a.length ? b : a, '');
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const out = [];

// 1. getElementById targets that exist neither in the HTML nor in JS-built markup
const htmlIds = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const jsIds = new Set([...js.matchAll(/id=\\?["']([A-Za-z0-9_\-]+)\\?["']/g)].map(m => m[1]));
const setIds = new Set([...js.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
const used = new Set([...js.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]));
const missing = [...used].filter(id => !htmlIds.has(id) && !jsIds.has(id) && !setIds.has(id));
if (missing.length) out.push(['ERROR', 'getElementById on ids that do not exist anywhere', missing]);

// 2. buttons in HTML that nothing is attached to
const btns = [...markup.matchAll(/<(?:button|a)[^>]*\sid="([^"]+)"/g)].map(m => m[1]);
const noHandler = btns.filter(id => {
  const re = new RegExp('getElementById\\(\\s*["\']' + id + '["\']\\s*\\)\\s*\\.\\s*(addEventListener|onclick|click)|["\']#' + id + '["\']|\\$\\(["\']#' + id + '["\']');
  const aliased = new RegExp('(var|let|const)\\s+\\w+\\s*=\\s*document\\.getElementById\\(\\s*["\']' + id + '["\']');
  return !re.test(js) && !aliased.test(js);
});
if (noHandler.length) out.push(['WARN', 'buttons with an id but no handler attached (check each)', noHandler]);

// 3. data-* attributes written into generated HTML but never looked up (the "not wired" bug class)
const gen = new Set([...js.matchAll(/data-([a-z][a-z0-9\-]*)=/g)].map(m => m[1]));
const staticAttrs = new Set([...markup.matchAll(/data-([a-z][a-z0-9\-]*)=/g)].map(m => m[1]));
const lookups = js;
const orphans = [];
gen.forEach(a => {
  const q = new RegExp('\\[data-' + a + '[\\]=\\^\\$\\*~|]|getAttribute\\(\\s*["\']data-' + a + '["\']|dataset\\.' + a.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + '|hasAttribute\\(\\s*["\']data-' + a);
  if (!q.test(lookups) && !/data-i18n/.test('data-' + a) && a !== 'varitem' && a !== 'no-mr') orphans.push(a);
});
if (orphans.length) out.push(['ERROR', 'data-attributes generated but never read anywhere (handler never wired)', orphans]);

// 4. wire-up call sites: every renderX that builds a data-<action> button must be followed by a querySelectorAll for it in the SAME function
const fnRe = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
let m; const starts = [];
while ((m = fnRe.exec(js))) starts.push({name: m[1], idx: m.index});
const perFn = [];
for (let i = 0; i < starts.length; i++) {
  const body = js.slice(starts[i].idx, i + 1 < starts.length ? starts[i + 1].idx : js.length);
  const made = [...body.matchAll(/data-([a-z][a-z0-9\-]*)="\s*['"]?\s*\+/g)].map(x => x[1]);
  const madeStatic = [...body.matchAll(/data-([a-z][a-z0-9\-]*)="/g)].map(x => x[1]);
  const all = new Set(made.concat(madeStatic));
  all.forEach(a => {
    if (/^i18n/.test(a)) return;
    const read = new RegExp('\\[data-' + a + '[\\]=\\^\\$\\*~|]').test(js);
    if (!read && a !== 'varitem' && a !== 'no-mr' && !new RegExp('getAttribute\\(\\s*["\'\']data-' + a).test(js)) perFn.push(starts[i].name + ' -> data-' + a);
  });
}
if (perFn.length) out.push(['ERROR', 'generated actions with no reader', perFn]);

// 5. inline onclick attributes calling functions that are not global (IIFE scope!)
const inl = [...new Set([...js.matchAll(/on(?:click|change|input)=\\?"([A-Za-z_]\w*)\(/g)].map(x => x[1]))];
const inlineBad = inl.filter(fn => !new RegExp('window\\.' + fn + '\\s*=').test(js));
if (inlineBad.length) out.push(['ERROR', 'inline on* handlers calling functions hidden inside the app closure', inlineBad]);

let errs = 0;
out.forEach(([sev, msg, list]) => { console.log(`[${sev}] ${msg}:\n   ` + list.join(', ')); if (sev === 'ERROR') errs++; });
console.log(out.length ? `\n${errs} error group(s)` : 'Wiring audit: clean');
process.exit(errs ? 1 : 0);
