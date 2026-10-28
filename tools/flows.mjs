// Shared helpers for flow tests
import {boot, tick} from './harness.mjs';
export const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
export function baseSeed(){
  return {
    business:{name:'Test Bar', address:'Pune', phone:'999', currency:'₹', billPrefix:'INV', dailySeq:1, lastBillDateKey:'', nextItemCode:1005, exciseLicenseNo:'FL-III/1', exciseLicenseType:'FL-III', exciseFilingDay:7, startingCashFloat:500, dayStartHour:0, staffRecoveryCode:null, receiptWidth:'58', billFooterText:'Thanks', upiId:'bar@upi', kotFoodEnabled:true},
    zones:[{id:'z1',name:'AC'},{id:'z2',name:'Non AC'}], tables:[{id:'t1',zoneId:'z1',number:'1'},{id:'t2',zoneId:'z1',number:'2'},{id:'t3',zoneId:'z2',number:'1'}],
    categories:[{id:'cat_liq',name:'Whisky',isExciseCategory:true,sendToKot:false,trackStock:true},{id:'cat_food',name:'Snacks',sendToKot:true,trackStock:false},{id:'cat_sd',name:'Soft Drinks',trackStock:true}],
    items:[
      {id:'i_rs', name:'Royal Stag 750 ml', categoryId:'cat_liq', saleRate:2000, trackStock:true, stockCounter:5, stockGodown:10, exciseTracked:true, liquorType:'Whisky (IMFL)', brand:'Royal Stag', bottleSize:'750 ml', pegPrices:{30:100,60:200,90:300}, lowStockThreshold:3, costPrice:1500, itemCode:'WHI001', barcodeValue:'1001'},
      {id:'i_ch', name:'Chicken Fry', categoryId:'cat_food', saleRate:250, trackStock:false, itemCode:'SNA001', barcodeValue:'1003'},
      {id:'i_cola', name:'Cola', categoryId:'cat_sd', saleRate:40, trackStock:true, stockCounter:20, stockGodown:5, exciseTracked:false, itemCode:'SOF001', barcodeValue:'1004', costPrice:25}
    ],
    vendors:[{id:'v1',name:'Sharma Traders',phone:'888',balance:5000}], customers:[{id:'c1',name:'Amit',phone:'777',balance:0,creditLimit:1000}],
    staff:[], openOrders:[], bills:[], purchases:[], stockLog:[], expenses:[], purchaseOrders:[], wastage:[], openingStockEntries:[], auditLog:[], exciseReconciliation:{}
  };
}
export async function app(mod, opts){
  const s = baseSeed(); if(mod) mod(s);
  const h = boot(s, opts);
  for(let i=0;i<30;i++) await tick();
  const T = h.ctx.__T, E = c => T.eval(c);
  const $ = id => h.document.getElementById(id);
  const key = (el, k, extra) => el.dispatchEvent(Object.assign({type:'keydown', key:k, bubbles:true}, extra||{}));
  const type = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent({type:'input', bubbles:true}); el.dispatchEvent({type:'change', bubbles:true}); return el; };
  const search = (q) => { const el = $('posItemSearch'); el.value = q; el.dispatchEvent({type:'input', bubbles:true}); key(el, 'Enter'); };
  return {h, T, E, $, key, type, search, d: () => T.data, toasts: h.toasts, dialogs: h.dialogs};
}
let pass = 0, fail = 0; const failures = [];
export function ok(c, n){ if(c){ pass++; console.log('  PASS  ' + n); } else { fail++; failures.push(n); console.log('  FAIL  ' + n); } }
export function eq(a, b, n){ const good = JSON.stringify(a) === JSON.stringify(b); ok(good, n + (good ? '' : '   [got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b) + ']')); }
export function near(a, b, n){ const good = Math.abs(a - b) < 0.005; ok(good, n + (good ? '' : '   [got ' + a + ' expected ' + b + ']')); }
export function section(t){ console.log('\n' + t); }
export function done(){ console.log('\n' + '='.repeat(50) + '\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); if(fail){ console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); } process.exit(0); }
