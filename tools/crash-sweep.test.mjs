// Crash sweep: boots the app with realistic data, renders every screen and "presses" every button
// that has a handler. Any exception thrown by app code is reported with the button id.
import {boot, tick} from './harness.mjs';
import vm from 'vm';

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
function seed(){
  const items = [
    {id:'i_rs', name:'Royal Stag 750 ml', categoryId:'cat_liq', saleRate:2000, trackStock:true, stockCounter:5, stockGodown:10, exciseTracked:true, liquorType:'Whisky (IMFL)', brand:'Royal Stag', bottleSize:'750 ml', pegPrices:{30:100,60:200,90:300}, lowStockThreshold:3, costPrice:1500, itemCode:'WHI001', barcodeValue:'1001', scmItemCode:'S1', bottlesPerCase:12},
    {id:'i_kf', name:'Kingfisher Strong 650 ml', categoryId:'cat_beer', saleRate:220, trackStock:true, stockCounter:24, stockGodown:48, exciseTracked:true, liquorType:'Fermented Beer', brand:'Kingfisher', bottleSize:'650 ml', lowStockThreshold:10, costPrice:150, itemCode:'BEE001', barcodeValue:'1002'},
    {id:'i_ch', name:'Chicken Fry', categoryId:'cat_food', saleRate:250, trackStock:false, itemCode:'SNA001', barcodeValue:'1003'},
    {id:'i_cola', name:'Cola', categoryId:'cat_sd', saleRate:40, trackStock:true, stockCounter:20, stockGodown:5, exciseTracked:false, itemCode:'SOF001', barcodeValue:'1004', costPrice:25, isFavorite:true}
  ];
  const bill = (id, n, total, mode, deleted) => ({id, billNo:'INV-000'+n, date:day(n%3), tableId:'t1', tableLabel:'1 (AC)', customer:'', items:[{itemId:'i_cola', name:'Cola', price:40, qty:2, pegMl:null},{itemId:'i_rs', name:'Royal Stag 750 ml', price:200, qty:1, pegMl:60}], subtotal:total, discount:0, servicePercent:0, serviceCharge:0, taxPercent:0, tax:0, total, paymentMode:mode, splitPayments:null, customerId: mode==='Credit'?'c1':null, staff:'', editLog:[], deleted: !!deleted});
  return {
    business:{name:'Test Bar', address:'Pune', phone:'999', currency:'₹', billPrefix:'INV', dailySeq:5, lastBillDateKey:'', nextItemCode:1005, exciseLicenseNo:'FL-III/1', exciseLicenseType:'FL-III', exciseFilingDay:7, startingCashFloat:500, dayStartHour:0, staffRecoveryCode:null, receiptWidth:'58', billFooterText:'Thanks', upiId:'bar@upi', kotFoodEnabled:true},
    zones:[{id:'z1',name:'AC'},{id:'z2',name:'Non AC'}], tables:[{id:'t1',zoneId:'z1',number:'1'},{id:'t2',zoneId:'z1',number:'2'},{id:'t3',zoneId:'z2',number:'1'}],
    categories:[{id:'cat_liq',name:'Whisky',isExciseCategory:true,sendToKot:false,trackStock:true},{id:'cat_beer',name:'Beer',isExciseCategory:true,sendToKot:false,trackStock:true},{id:'cat_food',name:'Snacks',sendToKot:true,trackStock:false},{id:'cat_sd',name:'Soft Drinks',trackStock:true}],
    items,
    vendors:[{id:'v1',name:'Sharma Traders',phone:'888',balance:5000,ledgerEntries:[{id:'l1',date:day(5),type:'purchase',amount:5000,refId:'p1',note:'Purchase PUR-0001'}],createdAt:day(30)}],
    customers:[{id:'c1',name:'Amit',phone:'777',balance:800,creditLimit:2000,ledgerEntries:[{id:'cl1',date:day(2),type:'sale',amount:800,refId:'b3',note:'Bill INV-0003'}],createdAt:day(30)}],
    staff:[], openOrders:[{id:'o1', tableId:'t2', items:[{key:'k1',itemId:'i_cola',name:'Cola',price:40,qty:2,pegMl:null},{key:'k2',itemId:'i_rs',name:'Royal Stag 750 ml',price:200,qty:1,pegMl:60}], discount:0, servicePercent:5, taxPercent:5, customer:'', customerPhone:''}],
    bills:[bill('b1',1,280,'Cash'), bill('b2',2,280,'UPI'), bill('b3',3,280,'Credit'), bill('b4',4,280,'Cash', true)],
    purchases:[{id:'p1', purchaseNo:'PUR-0001', date:day(5), vendorId:'v1', vendorName:'Sharma Traders', invoiceNo:'A1', invoiceDate:null, permitNo:'TP1', items:[{itemId:'i_rs', name:'Royal Stag 750 ml', qty:10, rate:1500},{itemId:'i_kf', name:'Kingfisher Strong 650 ml', qty:48, rate:150}], subtotal:22200, discount:0, tax:0, total:22200, paymentMode:'Credit'}],
    stockLog:[{id:'s1', itemId:'i_rs', itemName:'Royal Stag 750 ml', location:'godown', type:'purchase', qtyChange:10, balanceAfter:10, refId:'p1', date:day(5)},{id:'s2', itemId:'i_cola', itemName:'Cola', location:'counter', type:'sale', qtyChange:-2, balanceAfter:20, refId:'b1', date:day(1)}],
    expenses:[{id:'e1', date:day(1), category:'Rent', description:'Shop rent', amount:10000}],
    purchaseOrders:[{id:'po1', poNo:'PO-0001', date:day(3), expectedDate:null, vendorId:'v1', vendorName:'Sharma Traders', notes:'', status:'Pending', items:[{itemId:'i_rs', name:'Royal Stag 750 ml', orderedQty:6, receivedQty:0, rate:1500}]}],
    wastage:[{id:'w1', itemId:'i_kf', itemName:'Kingfisher Strong 650 ml', location:'counter', qty:1, reason:'Breakage', date:day(1)}],
    openingStockEntries:[{id:'os1', itemId:'i_cola', itemName:'Cola', location:'counter', qty:20, asOfDate:'2026-01-01', date:day(60)}],
    auditLog:[{id:'a1', date:day(1), staff:'', action:'Bill saved', detail:'INV-0001', flag:false}], exciseReconciliation:{}
  };
}

const errors = []; let pressed = 0;
const SKIP = new Set(['btnEraseAll','btnConfirmErase','btnRestoreBackup','btnRestoreArchive','btnArchiveRun']);
function fillInputs(h, root){
  const today = new Date().toISOString().slice(0,10);
  for(const el of root.querySelectorAll('input,select,textarea')){
    if(el.id && /^(mrWordsText)$/.test(el.id)) continue;
    const t = el.type;
    if(el.tagName === 'SELECT'){ const o = el.options; if(o.length > 1) el.value = o[1].value; else if(o.length) el.value = o[0].value; continue; }
    if(t === 'checkbox' || t === 'radio' || t === 'file' || t === 'button') continue;
    if(t === 'date') el.value = today; else if(t === 'month') el.value = today.slice(0,7); else if(t === 'number') el.value = '5'; else if(!el.value) el.value = 'Test ' + (el.id || 'x');
  }
}
async function sweep(confirmVal, round){
  const h = boot(seed(), {confirm: confirmVal});
  for(let i=0;i<30;i++) await tick();
  const T = h.ctx.__T;
  if(!T){ console.log('app failed to boot'); process.exit(1); }
  const E = c => T.eval(c);
  const screens = ['dashboard','billing','history','stock','purchase','purchaseorders','expenses','reports','ledger','setup'];
  for(const name of screens){
    try{ E(`switchScreen(${JSON.stringify(name)})`); }catch(e){ errors.push(`render screen ${name}: ${e.stack.split('\n')[0]}`); continue; }
    try{ E(`selectTable('t2')`); }catch(e){ errors.push('selectTable: ' + e.message); }
    // setup / reports have sub-tabs: visit each
    const scr = h.document.getElementById('screen-' + name); const tabs = scr.querySelectorAll('.subtab-btn');
    const groups = [null, ...tabs];
    for(const tab of groups){
      if(tab){ try{ tab.click(); }catch(e){ errors.push(`tab ${tab.getAttribute('data-setup-tab')||tab.id} on ${name}: ${e.stack.split('\n')[0]}`); } }
      fillInputs(h, scr);
      const clickables = scr.querySelectorAll('button,[data-togglegroup],[data-rmitem],[data-editbrand],[data-movecat],[data-togglefav],[data-barcode],[data-pegcalc],a[id],.cat-chip,.nav-item,.tile');
      for(const el of clickables){
        const id = el.id || el.getAttribute('data-rmitem') && 'rmitem' || '';
        if(SKIP.has(el.id)) continue;
        if(el.classList.contains('nav-item')) continue;
        if(process.env.TRACE) console.log("click", name, el.id || el.className, el.getAttribute("data-rmitem")||"");
        try{ h.ctx.__clickTarget = el; vm.runInContext('__clickTarget.click()', h.ctx, {timeout: 4000}); pressed++; }catch(e){ errors.push(`${name}/${tab ? (tab.getAttribute('data-setup-tab')||tab.id) : 'main'} -> <${el.tagName.toLowerCase()} id="${el.id}" class="${el.className}" ${[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name).join(' ')}> : ${e.stack.split('\n').slice(0,2).join(' | ')}`); }
        // close any modal left open so the next click is reachable
        for(const o of h.document.querySelectorAll('.modal-overlay.open')) o.classList.remove('open');
      }
    }
  }
}
await sweep(false);
await sweep(true);
console.log(`Clicks performed: ${pressed}`);
if(errors.length){ console.log('CRASHES (' + new Set(errors).size + '):\n - ' + [...new Set(errors)].slice(0,40).join('\n - ')); process.exit(1); }
console.log('Crash sweep: no exceptions');
process.exit(0);
