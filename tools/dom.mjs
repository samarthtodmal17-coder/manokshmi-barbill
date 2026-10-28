// Minimal but real DOM for testing: parses HTML into elements, supports the selector subset the app uses,
// event bubbling, form values, innerHTML re-parsing. Lets tests click buttons that the app creates dynamically.
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const ENT = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' ','&middot;':'·','&times;':'×','&rarr;':'→','&larr;':'←','&hellip;':'…','&bull;':'•'};
const decode = s => String(s).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, m => { if(ENT[m]) return ENT[m]; const n = m.match(/^&#(x?)([0-9a-f]+);$/i); return n ? String.fromCodePoint(parseInt(n[2], n[1] ? 16 : 10)) : m; });
const encode = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export class Node_ { constructor(){ this.parentNode = null; this.childNodes = []; } 
  get parentElement(){ return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get nextSibling(){ if(!this.parentNode) return null; const k = this.parentNode.childNodes; return k[k.indexOf(this)+1] || null; }
  get previousSibling(){ if(!this.parentNode) return null; const k = this.parentNode.childNodes; return k[k.indexOf(this)-1] || null; }
  get firstChild(){ return this.childNodes[0] || null; } get lastChild(){ return this.childNodes[this.childNodes.length-1] || null; }
}
export class Text_ extends Node_ { constructor(d){ super(); this.nodeType = 3; this.data = d; } get textContent(){ return this.data; } set textContent(v){ this.data = String(v); } get nodeValue(){ return this.data; } }

function parseSelectorPart(part){
  // compound selector -> {tag, id, classes[], attrs[], nots[]}
  const c = {tag:null, id:null, classes:[], attrs:[], nots:[]};
  let i = 0; const s = part;
  const ident = () => { const m = /^[A-Za-z0-9_\-\\]+/.exec(s.slice(i)); if(!m) return ''; i += m[0].length; return m[0]; };
  if(/^[A-Za-z*]/.test(s)){ c.tag = ident().toUpperCase(); if(c.tag === '*') c.tag = null; }
  while(i < s.length){
    const ch = s[i];
    if(ch === '#'){ i++; c.id = ident(); }
    else if(ch === '.'){ i++; c.classes.push(ident()); }
    else if(ch === '['){ const end = s.indexOf(']', i); const body = s.slice(i+1, end); i = end + 1;
      const m = /^([\w\-:]+)\s*(?:([\^\$\*~|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/.exec(body.trim()); if(m) c.attrs.push({name:m[1], op:m[2]||null, val: m[3] ?? m[4] ?? m[5] ?? ''}); }
    else if(ch === ':'){ i++; const name = ident(); if(s[i] === '('){ let depth = 1, j = i+1; while(j < s.length && depth){ if(s[j]==='(') depth++; else if(s[j]===')') depth--; j++; } const inner = s.slice(i+1, j-1); i = j; if(name === 'not') c.nots.push(parseSelectorPart(inner.trim())); } else if(name === 'checked') c.attrs.push({name:'__checked', op:null}); else if(name==='first-child'){ c.firstChild = true; } }
    else i++;
  }
  return c;
}
function splitSelector(sel){ // top-level commas, then combinators
  const groups = []; let depth = 0, cur = '';
  for(const ch of sel){ if(ch==='['||ch==='(') depth++; if(ch===']'||ch===')') depth--; if(ch === ',' && !depth){ groups.push(cur); cur=''; } else cur += ch; }
  if(cur.trim()) groups.push(cur);
  return groups.map(g => { const parts = []; let buf = '', d = 0, comb = ' ';
    const flush = () => { if(buf.trim()){ parts.push({comb, c: parseSelectorPart(buf.trim())}); } buf=''; };
    for(const ch of g.trim()){ if(ch==='['||ch==='(') d++; if(ch===']'||ch===')') d--;
      if(!d && (ch === ' ' || ch === '>')){ if(buf.trim()){ flush(); comb = ' '; } if(ch === '>') comb = '>'; }
      else buf += ch; }
    flush(); return parts; });
}
const selCache = new Map();
function compound(el, c){
  if(el.nodeType !== 1) return false;
  if(c.tag && el.tagName !== c.tag) return false;
  if(c.id && el.id !== c.id) return false;
  for(const k of c.classes) if(!el.classList.contains(k)) return false;
  for(const a of c.attrs){
    if(a.name === '__checked'){ if(!el.checked) return false; continue; }
    if(!el.hasAttribute(a.name)) return false;
    const v = el.getAttribute(a.name);
    if(a.op === '=' && v !== a.val) return false;
    if(a.op === '^=' && !v.startsWith(a.val)) return false;
    if(a.op === '$=' && !v.endsWith(a.val)) return false;
    if(a.op === '*=' && !v.includes(a.val)) return false;
    if(a.op === '~=' && !v.split(/\s+/).includes(a.val)) return false;
  }
  for(const n of c.nots) if(compound(el, n)) return false;
  if(c.firstChild && el.parentNode && el.parentNode.children[0] !== el) return false;
  return true;
}
function matchesChain(el, parts, idx, scope){
  if(!compound(el, parts[idx].c)) return false;
  if(idx === 0) return true;
  const comb = parts[idx].comb; let p = el.parentNode;
  if(comb === '>') return !!p && p.nodeType === 1 && matchesChain(p, parts, idx-1, scope);
  while(p && p.nodeType === 1){ if(matchesChain(p, parts, idx-1, scope)) return true; p = p.parentNode; }
  return false;
}
export function matches(el, sel){ let g = selCache.get(sel); if(!g){ g = splitSelector(sel); selCache.set(sel, g); } return g.some(parts => parts.length && matchesChain(el, parts, parts.length-1)); }

export class Element_ extends Node_ {
  constructor(tag, doc){ super(); this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.ownerDocument = doc; this._attrs = {}; this._listeners = {}; this._value = undefined; this._checked = undefined; this._style = null; this._disabled = false; }
  get id(){ return this._attrs.id || ''; } set id(v){ this._attrs.id = String(v); if(this.ownerDocument) this.ownerDocument._idx = null; }
  get className(){ return this._attrs.class || ''; } set className(v){ this._attrs.class = String(v); }
  get classList(){ const self = this; const get = () => (self._attrs.class || '').split(/\s+/).filter(Boolean); const set = a => { self._attrs.class = a.join(' '); };
    return { add:(...c)=>{ const a = get(); c.forEach(x=>{ if(!a.includes(x)) a.push(x); }); set(a); }, remove:(...c)=>set(get().filter(x=>!c.includes(x))), contains:c=>get().includes(c),
      toggle:(c,f)=>{ const has = get().includes(c); const on = f === undefined ? !has : !!f; if(on && !has) set([...get(), c]); if(!on && has) set(get().filter(x=>x!==c)); return on; } }; }
  get style(){ if(!this._style){ const t = {}; this._style = new Proxy(t, {get:(o,p)=> p==='setProperty' ? (k,v)=>{ o[k]=v; } : p==='removeProperty' ? ()=>{} : p==='cssText' ? Object.entries(o).map(([k,v])=>k+':'+v).join(';') : o[p], set:(o,p,v)=>{ o[p]=v; return true; }}); } return this._style; }
  get dataset(){ const o = {}; for(const k of Object.keys(this._attrs)) if(k.startsWith('data-')) o[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = this._attrs[k]; return o; }
  get attributes(){ return Object.entries(this._attrs).map(([name,value])=>({name,value})); }
  setAttribute(k,v){ k = k.toLowerCase(); this._attrs[k] = String(v); if(k === 'value') this._value = undefined; if(k === 'checked') this._checked = true; if(k === 'disabled') this._disabled = true; if(k==='id' && this.ownerDocument) this.ownerDocument._idx = null; }
  getAttribute(k){ k = k.toLowerCase(); return k in this._attrs ? this._attrs[k] : null; }
  hasAttribute(k){ return k.toLowerCase() in this._attrs; } removeAttribute(k){ delete this._attrs[k.toLowerCase()]; if(k==='disabled') this._disabled = false; if(k==='id' && this.ownerDocument) this.ownerDocument._idx = null; }
  get disabled(){ return this._disabled || 'disabled' in this._attrs; } set disabled(v){ this._disabled = !!v; if(v) this._attrs.disabled = ''; else delete this._attrs.disabled; }
  get type(){ return (this._attrs.type || (this.tagName==='INPUT'?'text':'')).toLowerCase(); } set type(v){ this._attrs.type = v; }
  get checked(){ return this._checked !== undefined ? this._checked : 'checked' in this._attrs; } set checked(v){ this._checked = !!v; }
  get selected(){ return this._selected !== undefined ? this._selected : 'selected' in this._attrs; } set selected(v){ this._selected = !!v; }
  get options(){ return this.querySelectorAll('option'); }
  get selectedIndex(){ const o = this.options; const i = o.findIndex(x=>x.selected); return i >= 0 ? i : (o.length ? 0 : -1); } set selectedIndex(i){ this.options.forEach((o,j)=>{ o.selected = j === i; }); }
  get value(){
    if(this.tagName === 'SELECT'){ const o = this.options; const sel = o.find(x=>x.selected) || o[0]; return sel ? sel.value : ''; }
    if(this.tagName === 'OPTION') return 'value' in this._attrs ? this._attrs.value : this.textContent;
    if(this.tagName === 'TEXTAREA') return this._value !== undefined ? this._value : this.textContent;
    return this._value !== undefined ? this._value : (this._attrs.value ?? '');
  }
  set value(v){
    if(this.tagName === 'SELECT'){ const o = this.options; let hit = false; o.forEach(x=>{ const m = x.value === String(v); x.selected = m && !hit; if(m) hit = true; }); return; }
    if(this.tagName === 'OPTION'){ this._attrs.value = String(v); return; }
    this._value = String(v);
  }
  get textContent(){ return this.childNodes.map(c=>c.textContent).join(''); }
  set textContent(v){ this.childNodes.forEach(c=>{ c.parentNode = null; }); this.childNodes = []; if(v !== '' && v != null){ const t = new Text_(String(v)); t.parentNode = this; this.childNodes.push(t); } }
  get innerText(){ return this.textContent; } set innerText(v){ this.textContent = v; }
  get children(){ return this.childNodes.filter(c=>c.nodeType===1); }
  get firstElementChild(){ return this.children[0] || null; }
  get innerHTML(){ return this.childNodes.map(c=> c.nodeType === 3 ? encode(c.data) : c.outerHTML).join(''); }
  set innerHTML(h){ this.childNodes.forEach(c=>{ c.parentNode = null; }); this.childNodes = []; parseInto(this, String(h), this.ownerDocument); if(this.ownerDocument) this.ownerDocument._idx = null; }
  get outerHTML(){ const attrs = Object.entries(this._attrs).map(([k,v])=>' '+k+'="'+String(v).replace(/"/g,'&quot;')+'"').join(''); const tag = this.tagName.toLowerCase(); return VOID.has(tag) ? '<'+tag+attrs+'>' : '<'+tag+attrs+'>'+this.innerHTML+'</'+tag+'>'; }
  insertAdjacentHTML(pos, h){ const tmp = new Element_('div', this.ownerDocument); parseInto(tmp, String(h), this.ownerDocument); const nodes = tmp.childNodes.slice(); nodes.forEach(n=>{ n.parentNode = null; });
    if(pos === 'beforeend') nodes.forEach(n=>this.appendChild(n)); else if(pos === 'afterbegin'){ nodes.reverse().forEach(n=>this.insertBefore(n, this.firstChild)); } else if(pos==='beforebegin' && this.parentNode){ nodes.forEach(n=>this.parentNode.insertBefore(n, this)); } else if(pos==='afterend' && this.parentNode){ nodes.reverse().forEach(n=>this.parentNode.insertBefore(n, this.nextSibling)); }
    if(this.ownerDocument) this.ownerDocument._idx = null; }
  appendChild(c){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); if(this.ownerDocument) this.ownerDocument._idx = null; return c; }
  insertBefore(c, ref){ if(c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if(i < 0) this.childNodes.push(c); else this.childNodes.splice(i,0,c); if(this.ownerDocument) this.ownerDocument._idx = null; return c; }
  removeChild(c){ const i = this.childNodes.indexOf(c); if(i >= 0){ this.childNodes.splice(i,1); c.parentNode = null; } if(this.ownerDocument) this.ownerDocument._idx = null; return c; }
  replaceChild(n, o){ const i = this.childNodes.indexOf(o); if(i < 0) return o; if(n.parentNode) n.parentNode.removeChild(n); this.childNodes[this.childNodes.indexOf(o)] = n; n.parentNode = this; o.parentNode = null; if(this.ownerDocument) this.ownerDocument._idx = null; return o; }
  remove(){ if(this.parentNode) this.parentNode.removeChild(this); }
  contains(n){ for(let p = n; p; p = p.parentNode) if(p === this) return true; return false; }
  cloneNode(deep){ const e = new Element_(this.tagName, this.ownerDocument); e._attrs = {...this._attrs}; if(this._value !== undefined) e._value = this._value; if(this._checked !== undefined) e._checked = this._checked; if(deep) this.childNodes.forEach(c=>{ e.appendChild(c.nodeType===3 ? new Text_(c.data) : c.cloneNode(true)); }); return e; }
  descendants(){ const out = []; const walk = n => n.childNodes.forEach(c=>{ if(c.nodeType===1){ out.push(c); walk(c); } }); walk(this); return out; }
  querySelectorAll(sel){ return this.descendants().filter(e => matches(e, sel)); }
  querySelector(sel){ return this.descendants().find(e => matches(e, sel)) || null; }
  matches(sel){ return matches(this, sel); }
  closest(sel){ for(let p = this; p && p.nodeType === 1; p = p.parentNode) if(matches(p, sel)) return p; return null; }
  getElementsByTagName(t){ t = t.toUpperCase(); return this.descendants().filter(e=>t==='*'||e.tagName===t); }
  getElementsByClassName(c){ return this.descendants().filter(e=>e.classList.contains(c)); }
  get isConnected(){ for(let p = this; p; p = p.parentNode) if(p === this.ownerDocument.body) return true; return false; }
  get offsetParent(){ return this.isConnected ? this.ownerDocument.body : null; }
  get offsetWidth(){ return 100; } get offsetHeight(){ return 20; } get scrollHeight(){ return 20; } get clientHeight(){ return 20; } get clientWidth(){ return 100; }
  getBoundingClientRect(){ return {top:0,left:0,width:100,height:20,right:100,bottom:20}; }
  scrollIntoView(){} scrollTo(){} focus(){ this.ownerDocument.activeElement = this; this._fire('focus'); } blur(){ if(this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; this._fire('blur'); } select(){}
  addEventListener(t,f,o){ const cap = o === true || !!(o && o.capture); const fn = f; fn.__cap = fn.__cap || {}; (this._listeners[t] = this._listeners[t] || []).push({f: fn, cap}); } removeEventListener(t,f){ if(this._listeners[t]) this._listeners[t] = this._listeners[t].filter(x=>x.f!==f); }
  _fire(t, ev){ const e = Object.assign({type:t, target:this, currentTarget:this, defaultPrevented:false, preventDefault(){ this.defaultPrevented = true; }, stopPropagation(){ this._stop = true; }, stopImmediatePropagation(){ this._stop = true; }}, ev||{}); return this.dispatchEvent(e); }
  dispatchEvent(e){ if(typeof e === 'string') e = {type:e}; e.target = e.target || this; e.defaultPrevented = !!e.defaultPrevented; e.preventDefault = e.preventDefault || function(){ this.defaultPrevented = true; }; e.stopPropagation = e.stopPropagation || function(){ this._stop = true; }; e.stopImmediatePropagation = e.stopImmediatePropagation || function(){ this._stop = true; this._stopNow = true; };
    const path = []; for(let p = this; p; p = p.parentNode) path.push(p); path.push(this.ownerDocument);
    const run = (n, wantCap, atTarget) => { const ls = (n._listeners && n._listeners[e.type]) || []; e.currentTarget = n; for(const L of ls.slice()){ if(e._stopNow) return; if(atTarget || L.cap === wantCap) L.f.call(n, e); } };
    // capture phase: document -> parent of target
    for(let i = path.length - 1; i >= 1 && !e._stop; i--) run(path[i], true, false);
    // target phase
    if(!e._stop) run(this, false, true);
    // bubble phase
    if(e.bubbles !== false) for(let i = 1; i < path.length && !e._stop; i++) run(path[i], false, false);
    return !e.defaultPrevented; }
  click(){ if(this.disabled) return; if(this.tagName === 'INPUT' && this.type === 'checkbox'){ this.checked = !this.checked; } this.dispatchEvent({type:'click', bubbles:true}); if(this.tagName==='INPUT' && (this.type==='checkbox'||this.type==='radio')) this.dispatchEvent({type:'change', bubbles:true}); }
}

function parseInto(parent, html, doc){
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = /<\/?([A-Za-z][A-Za-z0-9\-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)|</g;
  let m; const stack = [parent];
  while((m = re.exec(html))){
    const cur = stack[stack.length-1];
    if(m[3] !== undefined){ if(m[3].length){ const t = new Text_(decode(m[3])); t.parentNode = cur; cur.childNodes.push(t); } continue; }
    if(!m[1]){ const t = new Text_('<'); t.parentNode = cur; cur.childNodes.push(t); continue; }
    const tag = m[1].toLowerCase(); const full = m[0];
    if(full.startsWith('</')){ for(let i = stack.length-1; i > 0; i--){ if(stack[i].tagName.toLowerCase() === tag){ stack.length = i; break; } } continue; }
    const el = new Element_(tag, doc);
    const am = m[2] || ''; const are = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
    while((a = are.exec(am))){ el._attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? ''); }
    if(tag === 'option' && cur.tagName === 'OPTION') stack.pop();
    el.parentNode = stack[stack.length-1]; stack[stack.length-1].childNodes.push(el);
    if(tag === 'textarea' || tag === 'script' || tag === 'style'){ const end = html.indexOf('</' + tag, re.lastIndex); const raw = html.slice(re.lastIndex, end < 0 ? html.length : end); if(raw){ const t = new Text_(decode(raw)); t.parentNode = el; el.childNodes.push(t); } re.lastIndex = end < 0 ? html.length : html.indexOf('>', end) + 1; continue; }
    if(!VOID.has(tag) && !full.endsWith('/>')) stack.push(el);
  }
}

export class Document_ {
  constructor(){ this._listeners = {}; this.nodeType = 9; this._idx = null; this.activeElement = null; this.title = ''; this.cookie = '';
    this.documentElement = new Element_('html', this); this.body = new Element_('body', this); this.documentElement.appendChild(this.body); this.head = new Element_('head', this); }
  createElement(t){ return new Element_(t, this); } createTextNode(d){ return new Text_(d); } createDocumentFragment(){ return new Element_('fragment', this); }
  getElementById(id){ if(!this._idx){ this._idx = new Map(); for(const e of this.body.descendants()) if(e.id && !this._idx.has(e.id)) this._idx.set(e.id, e); } return this._idx.get(id) || null; }
  querySelector(s){ return this.body.querySelector(s); } querySelectorAll(s){ return this.body.querySelectorAll(s); }
  getElementsByTagName(t){ return this.body.getElementsByTagName(t); } getElementsByClassName(c){ return this.body.getElementsByClassName(c); }
  addEventListener(t,f,o){ const cap = o === true || !!(o && o.capture); (this._listeners[t] = this._listeners[t] || []).push({f, cap}); } removeEventListener(t,f){ if(this._listeners[t]) this._listeners[t] = this._listeners[t].filter(x=>x.f!==f); }
  dispatchEvent(e){ if(typeof e === 'string') e = {type:e}; e.target = e.target || this; e.defaultPrevented = !!e.defaultPrevented; e.preventDefault = e.preventDefault || function(){ this.defaultPrevented = true; }; e.stopPropagation = e.stopPropagation || function(){ this._stop = true; }; e.stopImmediatePropagation = e.stopImmediatePropagation || function(){ this._stop = true; this._stopNow = true; };
    e.currentTarget = this; for(const L of (this._listeners[e.type] || []).slice()){ if(e._stopNow) break; L.f.call(this, e); } return !e.defaultPrevented; }
  hasFocus(){ return true; } execCommand(){ return true; }
  loadBodyHtml(html){ this.body.childNodes = []; parseInto(this.body, html, this); this._idx = null; }
}
