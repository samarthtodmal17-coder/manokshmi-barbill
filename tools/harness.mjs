// Test harness: runs the real app (www/index.html) inside Node with a real mini-DOM (see dom.mjs),
// so business logic AND the buttons the app creates dynamically can be exercised by tests.
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import {fileURLToPath} from 'url';
import {Document_, Element_} from './dom.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));

export function boot(seed, opts = {}){
  const html = fs.readFileSync(process.env.HARNESS_HTML || path.join(here, '..', 'www', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let js = scripts.reduce((a,b) => b.length > a.length ? b : a, '');
  const bodyHtml = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [,''])[1].replace(/<script[\s\S]*?<\/script>/g, '');
  const document = new Document_();
  document.loadBodyHtml(bodyHtml);
  const toasts = [], dialogs = [];
  const store = {};
  if(seed) store['hotelProData_v1'] = JSON.stringify(seed);
  const localStorage = { getItem:k=> (k in store ? store[k] : null), setItem:(k,v)=>{ store[k]=String(v); }, removeItem:k=>{ delete store[k]; } };
  const sstore = {}; const sessionStorage = { getItem:k=> (k in sstore ? sstore[k] : null), setItem:(k,v)=>{ sstore[k]=String(v); }, removeItem:k=>{ delete sstore[k]; } };
  const timers = [];
  const ctx = { document, localStorage, sessionStorage, console: {log(){}, error(){}, warn(){}},
    setTimeout:(f)=>{ timers.push(f); return timers.length; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    alert(m){ dialogs.push(String(m)); }, confirm(m){ dialogs.push('CONFIRM: ' + m); return typeof opts.confirm === 'function' ? opts.confirm(m) : opts.confirm !== false; }, prompt(){ return null; },
    navigator: {clipboard:{writeText(){ return Promise.resolve(); }}, userAgent:'node'}, Blob: function(p){ this.parts = p; this.size = p.join('').length; }, URL: {createObjectURL(b){ ctx.__lastBlob = b; return 'blob:x'; }, revokeObjectURL(){}},
    Intl, Date, Math, JSON, Promise, Object, Array, String, Number, RegExp, Set, Map, WeakMap, Error, parseFloat, parseInt, isNaN, encodeURIComponent, decodeURIComponent, escape, unescape,
    FileReader: function(){ this.readAsText = function(f){ const self = this; Promise.resolve().then(() => self.onload && self.onload({target: {result: f.text}})); }; }, MutationObserver: function(){ this.observe=()=>{}; this.disconnect=()=>{}; }, Event: function(t){ this.type=t; }, CustomEvent: function(t){ this.type=t; }, KeyboardEvent: function(t, o){ Object.assign(this, o||{}); this.type=t; },
    requestAnimationFrame: f=>0, getComputedStyle: ()=>({}), matchMedia: ()=>({matches:false, addEventListener(){}}),
    qrcode: undefined, XLSX: undefined, IS_TAURI: false,
    openPrintWindow(){ const w = {document: {write(){}, close(){}, open(){}}, print(){}, close(){}, focus(){}}; return w; }, openExternal(){}, print(){}, location: {reload(){}, href:''},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){}, innerWidth: 1280, innerHeight: 800, scrollTo(){}, open(){ return null; }
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  js = js.replace('window.__barbillToast = showToast;', 'window.__T = {get data(){return data;}, set data(v){ data = v; }, eval: function(s){ return eval(s); }, showToast: showToast};');
  js = js.replace('function showToast(msg){', 'function showToast(msg){ try{ window.__toasts.push(String(msg)); }catch(e){}');
  ctx.__toasts = toasts;
  vm.createContext(ctx);
  vm.runInContext(js, ctx, {filename: 'index.html.js'});
  const runTimers = () => { while(timers.length){ const f = timers.shift(); try{ f(); }catch(e){} } };
  return {ctx, document, toasts, dialogs, store, runTimers, $: id => document.getElementById(id)};
}
export const tick = () => new Promise(r => setImmediate(r));
export {Element_};
