// Randomised stress test: hundreds of random business days (sales, purchases, deletes, edits, payments,
// menu changes) run through the real handlers; after EVERY step the books must still balance.
import {app, baseSeed} from './flows.mjs';
import {boot, tick} from './harness.mjs';

function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SEEDS = +(process.env.FUZZ_SEEDS || 120), STEPS = +(process.env.FUZZ_STEPS || 45);
let violations = [], steps = 0, crashes = [];

async function oneRun(seed){
  const R = rng(seed), pick = a => a[Math.floor(R() * a.length)], int = (a, b) => a + Math.floor(R() * (b - a + 1));
  const s = baseSeed();
  s.customers.push({id:'c2', name:'Raju', phone:'', balance:0, creditLimit:0});
  s.vendors.push({id:'v2', name:'Patil Wines', balance:0});
  s.items.push({id:'i_kf', name:'Kingfisher 650 ml', categoryId:'cat_liq', saleRate:220, trackStock:true, stockCounter:12, stockGodown:24, exciseTracked:true, liquorType:'Fermented Beer', bottleSize:'650 ml', costPrice:150, barcodeValue:'1010', itemCode:'BEE001'});
  const base = {}; s.items.forEach(i => { if(i.trackStock) base[i.id] = {c: i.stockCounter, g: i.stockGodown}; });
  const h = boot(s); for(let i=0;i<10;i++) await tick();
  const T = h.ctx.__T, E = c => T.eval(c), $ = id => h.document.getElementById(id), d = () => T.data;
  const log = [];
  const ops = {
    sell(){ E(`switchScreen('billing'); selectTable(${JSON.stringify(pick(['t1','t2','t3']))})`);
      const n = int(1,3); for(let k=0;k<n;k++){ const it = pick(d().items); if(it.pegPrices && R()<0.5) E(`addPegToCart(data.items.find(i=>i.id==='${it.id}'), ${pick([30,60,90])}, ${it.pegPrices[30]||100})`); else E(`addItemToCart(data.items.find(i=>i.id==='${it.id}'))`); }
      if(R()<0.3) $('posDiscount').value = String(int(0,30)); else $('posDiscount').value = '0';
      $('posServicePercent').value = R()<0.3 ? '5' : '0'; $('posTaxPercent').value = R()<0.3 ? '5' : '0';
      E(`(function(){ var o=currentOrder(); o.discount=parseFloat(document.getElementById('posDiscount').value)||0; o.servicePercent=parseFloat(document.getElementById('posServicePercent').value)||0; o.taxPercent=parseFloat(document.getElementById('posTaxPercent').value)||0; })()`);
      const mode = pick(['Cash','UPI','Credit','Card']); $('posPaymentMode').value = mode; $('posPaymentMode').dispatchEvent({type:'change'}); if(mode === 'Credit') $('posCreditCustomer').value = pick(['c1','c2']);
      $('btnSavePrintBill').click(); },
    purchase(){ E(`switchScreen('purchase')`); const n = int(1,2); for(let k=0;k<n;k++){ const it = pick(d().items); E(`purCart.push({itemId:'${it.id}', name:'${it.name}', qty:${int(1,12)}, rate:${int(10,1500)}})`); }
      $('purVendorSelect').value = pick(['v1','v2']); $('purPaymentMode').value = pick(['Cash','Credit']); $('purDiscount').value = '0'; $('purTaxPercent').value = pick(['0','5']); $('btnSavePurchase').click(); E(`purCart=[]`); },
    wastage(){ const it = pick(d().items.filter(i=>i.trackStock)); E(`switchScreen('stock')`); $('wastageItemSelect').value = it.id; $('wastageLocation').value = pick(['counter','godown']); $('wastageQty').value = String(int(1,3)); $('btnAddWastage').click(); },
    opening(){ const it = pick(d().items.filter(i=>i.trackStock)); E(`switchScreen('stock')`); $('openingStockItemSelect').value = it.id; $('openingStockLocation').value = pick(['counter','godown']); $('openingStockQty').value = String(int(1,10)); $('openingStockDate').value = '2020-01-01'; $('btnAddOpeningStock').click(); },
    transfer(){ const it = pick(d().items.filter(i=>i.trackStock)); E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; promptStockTransfer(data.items.find(i=>i.id==='${it.id}')); openFormModal=o; cap.onSave({qty:${int(1,6)}}); })()`); },
    deleteBill(){ const live = d().bills.filter(b=>!b.deleted); if(!live.length) return; const b = pick(live); E(`switchScreen('history')`); const btn = $('historyList').querySelector(`[data-del="${b.id}"]`); if(btn) btn.click(); },
    deletePurchase(){ const live = d().purchases.filter(p=>!p.deleted); if(!live.length) return; const p = pick(live); E(`renderPurchaseHistoryList()`); const btn = $('purchaseHistoryList').querySelector(`[data-delpur="${p.id}"]`); if(btn) btn.click(); },
    editBill(){ const live = d().bills.filter(b=>!b.deleted); if(!live.length) return; const b = pick(live); E(`openBillEditor(data.bills.find(x=>x.id==='${b.id}'))`); E(`editCart.forEach(function(c){ c.qty = ${int(1,5)}; })`);
      const mode = pick(['Cash','UPI','Credit']); $('editPaymentMode').value = mode; E(`renderEditCreditCustomerSelect()`); if(mode==='Credit') $('editCreditCustomer').value = pick(['c1','c2']); $('btnSaveBillEdit').click(); E(`hideBillEditor()`); },
    pay(){ const who = pick(['customer','vendor']); const rec = who==='customer' ? pick(d().customers) : pick(d().vendors); if((rec.balance||0) < 1) return; const amt = Math.max(1, Math.floor(rec.balance * R()));
      E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; ${who==='customer'?'promptCustomerPayment':'promptVendorPayment'}(data.${who==='customer'?'customers':'vendors'}.find(r=>r.id==='${rec.id}')); openFormModal=o; cap.onSave({amount:${amt}, mode:'Cash'}); })()`); },
    rename(){ const it = pick(d().items); E(`(function(){ var it=data.items.find(i=>i.id==='${it.id}'); var o=snapItem(it); it.name = it.name.replace(/ v\\d+$/,'') + ' v${int(1,99)}'; commitItemEdit(it,o); })()`); },
    reprice(){ const it = pick(d().items); E(`applyRateChange(data.items.find(i=>i.id==='${it.id}'), ${int(10,2500)})`); },
    expense(){ E(`switchScreen('expenses')`); $('expDate').value = '2026-10-01'; $('expAmount').value = String(int(10,500)); $('btnAddExpense').click(); },
    addToRunning(){ E(`switchScreen('billing'); selectTable('${pick(['t1','t2','t3'])}'); addItemToCart(data.items.find(i=>i.id==='${pick(d().items).id}'))`); }
  };
  const names = Object.keys(ops);
  const near = (a,b) => Math.abs(a-b) < 0.01;
  function check(label){
    const D = d();
    // I1 stock == base + log
    D.items.forEach(i => { if(!i.trackStock || !base[i.id]) return;
      ['counter','godown'].forEach(loc => { const sum = D.stockLog.filter(e=>e.itemId===i.id && e.location===loc).reduce((s,e)=>s+(e.qtyChange||0),0);
        const have = loc==='counter' ? i.stockCounter : i.stockGodown, want = (loc==='counter'?base[i.id].c:base[i.id].g) + sum;
        if(!near(have, want)) violations.push(`seed ${seed} after ${label}: ${i.name} ${loc} stock ${have} != base+log ${want}`); }); });
    // I2 ledgers == balances
    D.customers.forEach(c => { const sum = (c.ledgerEntries||[]).reduce((s,e)=>s+e.amount,0); if(!near(sum, c.balance||0)) violations.push(`seed ${seed} after ${label}: customer ${c.name} ledger ${sum} != balance ${c.balance}`); if((c.balance||0) < -0.001) violations.push(`seed ${seed} after ${label}: negative customer balance`); });
    D.vendors.forEach(v => { const sum = (v.ledgerEntries||[]).reduce((s,e)=>s+e.amount,0); const baseV = v.id==='v1'?5000:0; if(!near(sum + baseV, v.balance||0)) violations.push(`seed ${seed} after ${label}: vendor ${v.name} ledger ${sum + baseV} != balance ${v.balance}`); if((v.balance||0) < -0.001) violations.push(`seed ${seed} after ${label}: negative vendor balance`); });
    // I3 no NaN
    const bad = JSON.stringify(D).match(/NaN|null,"saleRate"/); if(/\bNaN\b/.test(JSON.stringify(D, (k,v)=> typeof v==='number' && isNaN(v) ? 'NaN' : v))) violations.push(`seed ${seed} after ${label}: NaN in data`);
    // I4 bill math
    D.bills.forEach(b => { if(b.deleted) return; const sub = b.items.reduce((s,c)=>s+c.price*c.qty,0); const after = Math.max(0, sub - (b.discount||0)); const svc = after*((b.servicePercent||0)/100); const tax = (after+svc)*((b.taxPercent||0)/100); if(!near(b.total, after+svc+tax)) violations.push(`seed ${seed} after ${label}: bill ${b.billNo} total ${b.total} != ${after+svc+tax}`); });
    // I5 a customer never owes more than their live credit bills
    D.customers.forEach(c => { const credit = D.bills.filter(b=>!b.deleted && b.customerId===c.id).reduce((s,b)=>s+b.total,0); if((c.balance||0) > credit + 0.01) violations.push(`seed ${seed} after ${label}: customer ${c.name} owes ${c.balance} but live credit bills total ${credit}`); });
    // I6 running orders only reference real items
    D.openOrders.forEach(o => o.items.forEach(c => { if(!D.items.some(i=>i.id===c.itemId)) violations.push(`seed ${seed} after ${label}: ghost line ${c.name}`); }));
    // I8 excise register closing == stock on hand (less any un-logged starting stock)
    D.items.forEach(i => { if(!i.trackStock || !base[i.id] || !i.exciseTracked) return; const p = E(`exciseItemPeriod('${i.id}', '2000-01-01', '2099-12-31')`); const want = (i.stockCounter||0) + (i.stockGodown||0) - base[i.id].c - base[i.id].g;
      if(!near(p.closing, want)) violations.push(`seed ${seed} after ${label}: excise register closing ${p.closing} != stock movement ${want} for ${i.name}`);
      if(!near(p.opening + p.receipts - p.sales - p.wastage + (p.closing - (p.opening + p.receipts - p.sales - p.wastage)), p.closing)) violations.push('register arithmetic'); });
    // I9 health check must never report an error-level problem after normal use
    E(`runMenuHealthCheck()`).forEach(x => { if(x.sev === 'error') violations.push(`seed ${seed} after ${label}: health check error: ${x.text}`); });
    // I7 daily closing totals = sum of non-deleted bills
    const live = D.bills.filter(b=>!b.deleted);
    if(live.length){ const k = new Date().toISOString().slice(0,10); const html = E(`buildDailyClosingHtml('${k}','${k}',null,0)`); const txt = html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' '); const m = txt.match(/Total Sales\s*₹?\s*([\d,]+\.\d\d)/); if(m){ const shown = parseFloat(m[1].replace(/,/g,'')); const want = live.reduce((s,b)=>s+b.total,0); if(!near(shown, want)) violations.push(`seed ${seed} after ${label}: closing total ${shown} != bills ${want}`); } }
  }
  for(let n = 0; n < STEPS; n++){
    const op = pick(names); log.push(op);
    try{ ops[op](); }catch(e){ crashes.push(`seed ${seed} step ${n} op ${op}: ${e.stack.split('\n').slice(0,2).join(' | ')}`); break; }
    for(const o of h.document.querySelectorAll('.modal-overlay.open')) o.classList.remove('open');
    steps++; check(`step ${n} (${op})`);
    if(violations.length > 25) break;
  }
}
for(let sd = 1; sd <= SEEDS; sd++){ await oneRun(sd * 7919); if(violations.length > 25 || crashes.length > 10) break; }
console.log(`Random business days: ${SEEDS}, steps executed: ${steps}`);
if(crashes.length) console.log('CRASHES:\n - ' + [...new Set(crashes)].slice(0,15).join('\n - '));
if(violations.length){ const uniq = [...new Set(violations.map(v => v.replace(/seed \d+ after step \d+ /,'')))]; console.log('BOOKS DID NOT BALANCE (' + violations.length + '):\n - ' + uniq.slice(0,20).join('\n - ')); console.log('first: ' + violations[0]); }
if(crashes.length || violations.length) process.exit(1);
console.log('Fuzz: every invariant held on every step');
process.exit(0);
