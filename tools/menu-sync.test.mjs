// Menu <-> Stock <-> Billing sync regression suite.
// Run:  node tools/menu-sync.test.mjs
import {boot, tick} from './harness.mjs';

let pass = 0, fail = 0; const failures = [];
function ok(cond, name){ if(cond){ pass++; console.log('  PASS  ' + name); } else { fail++; failures.push(name); console.log('  FAIL  ' + name); } }
function eq(a, b, name){ ok(JSON.stringify(a) === JSON.stringify(b), name + (JSON.stringify(a) === JSON.stringify(b) ? '' : '   [got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b) + ']')); }

function seed(){
  return {
    business: {name:'Test Bar', billPrefix:'INV', dailySeq:1, lastBillDateKey:'', nextItemCode:1001, currency:'₹', kotFoodEnabled:true},
    zones:[{id:'z1',name:'AC'}], tables:[{id:'t1',zoneId:'z1',number:'1'},{id:'t2',zoneId:'z1',number:'2'}],
    categories:[
      {id:'cat_liq', name:'Whisky', isExciseCategory:true, sendToKot:false, trackStock:true},
      {id:'cat_food', name:'Snacks', sendToKot:true, trackStock:false},
      {id:'cat_sd', name:'Soft Drinks', trackStock:true}
    ],
    items:[
      {id:'i_rs', name:'Royal Stag 750 ml', categoryId:'cat_liq', saleRate:2000, trackStock:true, stockCounter:5, stockGodown:10, exciseTracked:true, liquorType:'Whisky (IMFL)', brand:'Royal Stag', bottleSize:'750 ml', pegPrices:{30:100,60:200,90:300}, lowStockThreshold:3, costPrice:1500},
      {id:'i_ch', name:'Chicken Fry', categoryId:'cat_food', saleRate:250, trackStock:false, stockCounter:0, stockGodown:0},
      {id:'i_pc', name:'Peanut Masala', categoryId:'cat_food', saleRate:80, trackStock:false},
      {id:'i_cola', name:'Cola', categoryId:'cat_sd', saleRate:40, trackStock:true, stockCounter:20, stockGodown:0, exciseTracked:false},
      {id:'i_nolt', name:'Old Tavern', categoryId:'cat_liq', saleRate:900, trackStock:true, stockCounter:2, stockGodown:0, exciseTracked:true}
    ],
    vendors:[], customers:[], staff:[], openOrders:[], bills:[], purchases:[], stockLog:[], expenses:[], purchaseOrders:[], wastage:[], openingStockEntries:[], auditLog:[]
  };
}
async function fresh(extra){
  const s = seed(); if(extra) extra(s);
  localStorageSeed = s;
  const h = boot(s);
  for(let i=0;i<30;i++) await tick();
  const T = h.ctx.__T;
  const E = code => T.eval(code);
  return {h, T, E, d: ()=>T.data};
}
let localStorageSeed;
const line = (key,itemId,name,price,qty,pegMl)=>({key, itemId, name, price, qty, pegMl: pegMl||null});

console.log('\n[1] Boot');
{
  const {T, d} = await fresh();
  ok(!!T, 'app boots in harness');
  eq(d().items.length, 5, 'seed items loaded');
}

console.log('\n[2] Price change propagates to running tables');
{
  const {E, d} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_ch','Chicken Fry',250,2), line('b','i_pc','Peanut Masala',70,1) /* hand-edited rate */], discount:0}); });
  E(`applyRateChange(data.items.find(i=>i.id==='i_ch'), 275)`);
  E(`applyRateChange(data.items.find(i=>i.id==='i_pc'), 90)`);
  const o = d().openOrders[0];
  eq(o.items[0].price, 275, 'running line at old menu price follows new menu price');
  eq(o.items[1].price, 70, 'hand-edited cashier rate is NOT overwritten');
  eq(d().items.find(i=>i.id==='i_ch').saleRate, 275, 'menu item updated');
}

console.log('\n[3] Peg lines follow peg price');
{
  const {E, d} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_rs','Royal Stag 750 ml',200,1,60), line('b','i_rs','Royal Stag 750 ml',2000,1)], discount:0}); });
  E(`(function(){ var it=data.items.find(i=>i.id==='i_rs'); var o=snapItem(it); it.pegPrices={30:110,60:220,90:330}; it.saleRate=2200; commitItemEdit(it,o); })()`);
  const o = d().openOrders[0];
  eq(o.items[0].price, 220, '60ml peg line updated to new peg price');
  eq(o.items[1].price, 2200, 'full bottle line updated to new bottle price');
}

console.log('\n[4] Rename propagates everywhere');
{
  const {E, d} = await fresh(s => {
    s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_ch','Chicken Fry',250,1)], discount:0});
    s.purchaseOrders.push({id:'po1', poNo:'PO-0001', status:'Pending', items:[{itemId:'i_ch', name:'Chicken Fry', orderedQty:5, receivedQty:0, rate:100}]});
    s.wastage.push({id:'w1', itemId:'i_ch', itemName:'Chicken Fry', location:'counter', qty:1, reason:'Breakage', date:new Date().toISOString()});
  });
  E(`(function(){ var it=data.items.find(i=>i.id==='i_ch'); var o=snapItem(it); it.name='Chicken Fry Special'; commitItemEdit(it,o); })()`);
  eq(d().openOrders[0].items[0].name, 'Chicken Fry Special', 'running bill line renamed');
  eq(d().purchaseOrders[0].items[0].name, 'Chicken Fry Special', 'purchase order line renamed');
  eq(E(`liveItemName('i_ch','x')`), 'Chicken Fry Special', 'live name used by history lists');
  eq(E(`liveItemName('gone','Old Name')`), 'Old Name', 'removed item falls back to stored name');
}

console.log('\n[5] Category switches sync items');
{
  const {E, d} = await fresh();
  let r = E(`applyCategoryFlag(data.categories.find(c=>c.id==='cat_sd'),'track')`);
  eq(d().items.find(i=>i.id==='i_cola').trackStock, false, 'category Track Stock OFF applies to existing items');
  E(`applyCategoryFlag(data.categories.find(c=>c.id==='cat_sd'),'track')`);
  eq(d().items.find(i=>i.id==='i_cola').trackStock, true, 'category Track Stock ON applies to existing items');
  eq(d().items.find(i=>i.id==='i_cola').stockCounter, 20, 'turning tracking off/on does not destroy the stock figure');
  r = E(`applyCategoryFlag(data.categories.find(c=>c.id==='cat_sd'),'excise')`);
  eq(d().items.find(i=>i.id==='i_cola').exciseTracked, true, 'category Excise ON applies to existing items');
  eq(r.missingType, 1, 'items without Liquor Type are reported after excise ON');
  E(`applyCategoryFlag(data.categories.find(c=>c.id==='cat_sd'),'excise')`);
  eq(d().items.find(i=>i.id==='i_cola').exciseTracked, false, 'category Excise OFF applies');
  const kotBefore = d().categories.find(c=>c.id==='cat_food').sendToKot;
  E(`applyCategoryFlag(data.categories.find(c=>c.id==='cat_food'),'kot')`);
  eq(d().categories.find(c=>c.id==='cat_food').sendToKot, !kotBefore, 'KOT switch toggles');
  ok(d().auditLog.some(a=>/Category setting changed/.test(a.action)), 'category change is audit-logged');
}

console.log('\n[6] Bulk rate change by category');
{
  const {E, d} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_rs','Royal Stag 750 ml',200,1,60)], discount:0}); });
  // emulate the bulk-adjust save logic through the real modal
  E(`(function(){ var saved=openFormModal; var cap; openFormModal=function(o){cap=o;}; 
     var box={querySelectorAll:function(sel){ if(sel==='[data-bulkrate]'){ return [{getAttribute:function(){return 'cat_liq';}, addEventListener:function(t,f){ if(t==='click') window.__bulk=f; }}]; } return []; }, querySelector:function(){return null;}};
     window.__box=box; })()`);
  // simpler: call renderCategoryList through a real wiring is DOM-bound, so test the maths via the same code path used: invoke modal handler directly
  const r = E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; };
     var cat=data.categories.find(c=>c.id==='cat_liq');
     // find handler by re-wiring renderCategoryList with a fake box
     var handlers=[]; var realQSA;
     var fakeBtn={getAttribute:function(){return cat.id;}, addEventListener:function(t,f){ handlers.push(f); }};
     var fakeBox={innerHTML:'', querySelectorAll:function(sel){ return sel==='[data-bulkrate]'?[fakeBtn]:[]; }, querySelector:function(){return null;}};
     var origGet=document.getElementById; document.getElementById=function(id){ if(id==='categoryListLiquor'||id==='categoryListFood') return fakeBox; return origGet.call(document,id); };
     renderCategoryList(); document.getElementById=origGet;
     handlers[0](); var res=cap.onSave({mode:'pct', value:10}); openFormModal=orig; return res||'ok'; })()`);
  const rs = d().items.find(i=>i.id==='i_rs');
  eq(rs.saleRate, 2200, 'bottle rate +10%');
  eq(rs.pegPrices[60], 220, 'peg prices scale with bottle price');
  eq(d().openOrders[0].items[0].price, 220, 'running peg line follows bulk change');
}

console.log('\n[7] Item removal safety');
{
  const {E, d} = await fresh(s => {
    s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_ch','Chicken Fry',250,1)], discount:0});
    s.purchaseOrders.push({id:'po1', poNo:'PO-0001', status:'Pending', items:[{itemId:'i_pc', name:'Peanut Masala', orderedQty:5, receivedQty:0, rate:50}]});
  });
  ok(/running bill/.test(E(`itemRemovalBlocker(data.items.find(i=>i.id==='i_ch'))`)), 'item on a running bill cannot be removed');
  eq(E(`itemRemovalBlocker(data.items.find(i=>i.id==='i_cola'))`), '', 'unused item can be removed');
  eq(E(`pendingPoWithItem('i_pc').length`), 1, 'pending PO detected for item');
  eq(E(`pendingPoWithItem('i_cola').length`), 0, 'no false PO match');
}

console.log('\n[8] Billing after menu edits (end to end)');
{
  const {E, d, h} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_cola','Cola',40,3)], discount:0, servicePercent:0, taxPercent:0}); });
  E(`(function(){ var it=data.items.find(i=>i.id==='i_cola'); var o=snapItem(it); it.name='Cola 600ml'; it.saleRate=45; commitItemEdit(it,o); })()`);
  eq(d().openOrders[0].items[0].price, 45, 'bill line has new price before billing');
  E(`currentTableId='t1'`);
  h.document.getElementById('posPaymentMode').value = 'Cash';
  try{ h.document.getElementById('btnSavePrintBill').click(); }catch(e){ console.log('   (bill click error: ' + e.message + ')'); }
  const b = d().bills[d().bills.length-1];
  ok(!!b, 'bill saved');
  if(b){
    eq(b.items[0].name, 'Cola 600ml', 'bill carries the new item name');
    eq(b.total, 135, 'bill total uses the new price (3 x 45)');
    eq(d().items.find(i=>i.id==='i_cola').stockCounter, 17, 'stock deducted by sold quantity');
    ok(!d().auditLog.some(a=>a.action==='Rate changed'), 'no false "Rate changed" flag after a menu price edit');
  }
}

console.log('\n[9] Stock tracking toggle on a single item');
{
  const {E, d} = await fresh();
  E(`(function(){ var it=data.items.find(i=>i.id==='i_cola'); var o=snapItem(it); it.trackStock=false; commitItemEdit(it,o); })()`);
  ok(d().auditLog.some(a=>a.action==='Stock tracking changed'), 'tracking change is audit-logged');
  eq(E(`isLowStock(data.items.find(i=>i.id==='i_cola'))`), false, 'untracked item never shows as low stock');
  E(`(function(){ var it=data.items.find(i=>i.id==='i_cola'); var o=snapItem(it); it.trackStock=true; commitItemEdit(it,o); })()`);
  eq(d().items.find(i=>i.id==='i_cola').stockCounter, 20, 'stock figure intact after re-enabling');
}

console.log('\n[10] Real Edit / Brand Info modal path');
{
  const {E, d} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_rs','Royal Stag 750 ml',2000,1), line('b','i_rs','Royal Stag 750 ml',100,1,30)], discount:0}); });
  const res = E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; };
     promptEditBrandInfo(data.items.find(i=>i.id==='i_rs')); openFormModal=orig;
     var vals={}; cap.fields.forEach(function(f){ vals[f.key]=f.value; });
     vals.name='Royal Stag 750 ml Premium'; vals.trackStock='no'; vals.peg30=120; vals.peg60=240; vals.peg90=360; vals.bottlesPerCase=12; vals.mrp=2100;
     return cap.onSave(vals) || 'saved'; })()`);
  eq(res, 'saved', 'Edit modal saves without error');
  const rs = d().items.find(i=>i.id==='i_rs');
  eq(rs.name, 'Royal Stag 750 ml Premium', 'item renamed via modal');
  eq(rs.trackStock, false, 'Track Stock switch in modal applies');
  eq(d().openOrders[0].items[0].name, 'Royal Stag 750 ml Premium', 'running bill renamed via modal');
  eq(d().openOrders[0].items[1].price, 120, '30ml peg line follows new peg price via modal');
}

console.log('\n[11] Move item between categories');
{
  const {E, d} = await fresh();
  const res = E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; };
     promptMoveItemCategory(data.items.find(i=>i.id==='i_cola')); openFormModal=orig;
     return cap.onSave({categoryId:'cat_food', updateExcise:'match'}) || 'ok'; })()`);
  const it = d().items.find(i=>i.id==='i_cola');
  eq(it.categoryId, 'cat_food', 'item moved');
  eq(it.trackStock, false, 'tracking follows destination category default when "match" chosen');
}

console.log('\n[12] Quick-edit table (food menu) real change handler');
{
  const {E, d} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_ch','Chicken Fry',250,1)], discount:0}); });
  const result = E(`(function(){
     var handlers = {};
     function fake(kind,id,val,type){ var h={}; return {type:type||'text', value:val, checked:false, classList:{add:function(){},remove:function(){}}, getAttribute:function(a){ return a==='data-fe'?kind: a==='data-id'?id:null; }, addEventListener:function(t,f){ h[t]=f; }, blur:function(){}, focus:function(){}, select:function(){}, _h:h}; }
     var nameEl=fake('name','i_ch','Chicken Fry'), rateEl=fake('rate','i_ch','300'), trackEl=fake('track','i_ch','',"checkbox");
     var box={ querySelectorAll:function(sel){ if(sel==='[data-fe]') return [nameEl,rateEl,trackEl]; return []; }, querySelector:function(){ return null; } };
     wireFoodQuickEdit(box);
     rateEl._h.change();
     nameEl.value='Chicken Fry Jumbo'; nameEl._h.change();
     trackEl.checked=true; trackEl._h.change();
     return 'done'; })()`);
  const it = d().items.find(i=>i.id==='i_ch');
  eq(it.saleRate, 300, 'quick edit: price saved');
  eq(it.name, 'Chicken Fry Jumbo', 'quick edit: name saved');
  eq(it.trackStock, true, 'quick edit: tracking saved');
  eq(d().openOrders[0].items[0].price, 300, 'quick edit: running bill price updated');
  eq(d().openOrders[0].items[0].name, 'Chicken Fry Jumbo', 'quick edit: running bill name updated');
}

console.log('\n[13] Duplicate & validation guards');
{
  const {E, d, h} = await fresh();
  ok(!!E(`findDuplicateItem('royal stag 750ml', 750, null)`), 'duplicate detected ignoring case/spaces');
  eq(E(`findDuplicateItem('Brand New Item', null, null)`) || null, null, 'new name is not a duplicate');
}

console.log('\n[14] Add Item form -> menu -> stock defaults');
{
  const {E, d, h} = await fresh();
  const set = (id, v) => { h.document.getElementById(id).value = v; };
  E(`switchScreen('setup'); menuMode='food'; applyMenuMode(); renderItemSelects();`);
  set('newItemName', 'Paneer Tikka'); set('newItemCategory', 'cat_sd'); set('newItemRate', '220'); set('newItemCost', '90'); set('newItemThreshold', '');
  h.document.getElementById('newItemTrackStock').checked = true;
  h.document.getElementById('btnAddItem').click();
  const it = d().items.find(i => i.name === 'Paneer Tikka');
  ok(!!it, 'new item created');
  if(it){
    eq(it.saleRate, 220, 'new item rate saved');
    eq(it.trackStock, true, 'new item tracking follows the form');
    ok(!!it.itemCode && !!it.barcodeValue, 'new item gets item code and barcode');
    eq(d().items.filter(i => i.barcodeValue === it.barcodeValue).length, 1, 'barcode is unique');
  }
  set('newItemName', 'paneer  TIKKA'); set('newItemRate', '10');
  h.document.getElementById('btnAddItem').click();
  eq(d().items.filter(i => /paneer/i.test(i.name)).length, 1, 'duplicate name (case/spacing) is refused');
}

console.log('\n[15] Purchase -> stock sync');
{
  const {E, d, h} = await fresh(s => { s.vendors.push({id:'v1', name:'Sharma Traders', balance:0}); });
  const set = (id, v) => { h.document.getElementById(id).value = v; };
  E(`switchScreen('purchase')`);
  set('purVendorSelect', 'v1'); set('purPaymentMode', 'Credit'); set('purDiscount', 0); set('purTaxPercent', 0); set('purInvoiceNo', 'A1'); set('purInvoiceDate', ''); set('purPermitNo', '');
  E(`purCart.push({itemId:'i_rs', name:'Royal Stag 750 ml', qty:12, rate:1600}); purCart.push({itemId:'i_ch', name:'Chicken Fry', qty:4, rate:100});`);
  h.document.getElementById('btnSavePurchase').click();
  const rs = d().items.find(i => i.id === 'i_rs');
  eq(rs.stockGodown, 22, 'tracked item: godown stock increased by purchase qty');
  eq(rs.costPrice, 1600, 'cost price follows last purchase rate');
  eq(d().items.find(i => i.id === 'i_ch').stockGodown || 0, 0, 'untracked item keeps no stock figure');
  eq(d().vendors[0].balance, 12*1600 + 4*100, 'vendor balance updated for credit purchase');
  eq(d().purchases.length, 1, 'purchase recorded');
}

console.log('\n[16] Purchase blocked when an entry line was removed from the menu');
{
  const {E, d, h} = await fresh(s => { s.vendors.push({id:'v1', name:'Sharma Traders', balance:0}); });
  const set = (id, v) => { h.document.getElementById(id).value = v; };
  E(`switchScreen('purchase')`);
  set('purVendorSelect', 'v1'); set('purPaymentMode', 'Credit'); set('purDiscount', 0); set('purTaxPercent', 0);
  E(`purCart.push({itemId:'i_cola', name:'Cola', qty:10, rate:20});`);
  E(`data.items = data.items.filter(i => i.id !== 'i_cola')`);
  h.document.getElementById('btnSavePurchase').click();
  eq(d().purchases.length, 0, 'purchase not saved with a ghost line');
  eq(d().vendors[0].balance, 0, 'vendor balance untouched');
  ok(h.toasts.some(t => /removed from the menu/.test(t)), 'user is told why');
}

console.log('\n[17] Draft purchase entry follows a rename');
{
  const {E, d} = await fresh();
  E(`purCart.push({itemId:'i_cola', name:'Cola', qty:1, rate:20}); poCart.push({itemId:'i_cola', name:'Cola', qty:1, rate:20});`);
  E(`(function(){ var it=data.items.find(i=>i.id==='i_cola'); var o=snapItem(it); it.name='Cola Zero'; commitItemEdit(it,o); })()`);
  eq(E(`purCart[0].name`), 'Cola Zero', 'purchase draft renamed');
  eq(E(`poCart[0].name`), 'Cola Zero', 'purchase order draft renamed');
}

console.log('\n[18] History is untouched by later menu edits');
{
  const {E, d, h} = await fresh(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_cola','Cola',40,2)], discount:0, servicePercent:0, taxPercent:0}); });
  E(`currentTableId='t1'`); h.document.getElementById('posPaymentMode').value = 'Cash';
  h.document.getElementById('btnSavePrintBill').click();
  const bill = d().bills[0];
  E(`(function(){ var it=data.items.find(i=>i.id==='i_cola'); var o=snapItem(it); it.name='Cola Zero'; it.saleRate=99; commitItemEdit(it,o); })()`);
  eq(d().bills[0].items[0].name, 'Cola', 'saved bill keeps the name it was sold under');
  eq(d().bills[0].total, bill.total, 'saved bill total unchanged');
  eq(d().items.find(i=>i.id==='i_cola').stockCounter, 18, 'stock level unaffected by rename/price edit');
}

console.log('\n[19] Re-enabling tracking with no stock warns the owner');
{
  const {E, d, h} = await fresh();
  E(`(function(){ var it=data.items.find(i=>i.id==='i_ch'); var o=snapItem(it); it.trackStock=true; commitItemEdit(it,o); })()`);
  ok(h.toasts.some(t => /add Opening Stock/.test(t)), 'hint shown when tracking is on but stock is 0');
}

console.log('\n[20] Health check finds and fixes real problems');
{
  const {E, d, h} = await fresh(s => {
    s.items.push({id:'i_dupb', name:'Dup Barcode', categoryId:'cat_sd', saleRate:10, trackStock:true, barcodeValue:'1001', exciseTracked:false});
    s.items.find(i=>i.id==='i_cola').barcodeValue = '1001';
    s.items.push({id:'i_mis', name:'Mismatch', categoryId:'cat_liq', saleRate:50, trackStock:false, exciseTracked:false, liquorType:'Other', barcodeValue:'2002'});
    s.openOrders.push({id:'o1', tableId:'t1', items:[line('a','i_ch','Old Chicken Name',250,1), line('g','i_gone','Ghost',10,1)], discount:0});
  });
  const texts = E(`runMenuHealthCheck().map(function(x){ return x.sev + ': ' + x.text; })`);
  ok(texts.some(t => /refer to items that were removed/.test(t)), 'detects ghost lines on running bills');
  ok(texts.some(t => /old item name/.test(t)), 'detects stale names on running bills');
  ok(texts.some(t => /share a barcode/.test(t)), 'detects duplicate barcodes');
  ok(texts.some(t => /Excise setting different/.test(t)), 'detects excise flag vs category mismatch');
  ok(texts.some(t => /Track Stock setting different/.test(t)), 'detects track-stock flag vs category mismatch');
  ok(texts.some(t => /no Liquor Type/.test(t)), 'detects excise item without liquor type');
  E(`runMenuHealthCheck().forEach(function(x){ if(x.fix && /old item name|barcode/.test(x.text)) x.fix(); })`);
  eq(d().openOrders[0].items[0].name, 'Chicken Fry', 'fix: running bill names refreshed');
  const bars = d().items.map(i=>i.barcodeValue);
  eq(new Set(bars).size, bars.length, 'fix: all barcodes unique and present');
  E(`runMenuHealthCheck().forEach(function(x){ if(x.fix && /Excise setting different/.test(x.text)) x.fix(); })`);
  eq(d().items.find(i=>i.id==='i_mis').exciseTracked, true, 'fix: item follows category excise setting');
}

console.log('\n[21] New items never reuse an existing barcode');
{
  const {E, d, h} = await fresh(s => { s.items.find(i=>i.id==='i_cola').barcodeValue = '1001'; s.items.find(i=>i.id==='i_ch').barcodeValue = '1002'; });
  const set = (id, v) => { h.document.getElementById(id).value = v; };
  E(`switchScreen('setup'); menuMode='food'; applyMenuMode(); renderItemSelects();`);
  set('newItemName', 'Veg Roll'); set('newItemCategory', 'cat_food'); set('newItemRate', '60'); set('newItemCost', ''); set('newItemThreshold', '');
  h.document.getElementById('btnAddItem').click();
  const it = d().items.find(i => i.name === 'Veg Roll');
  ok(!!it && it.barcodeValue !== '1001' && it.barcodeValue !== '1002', 'barcode skips values already in use (' + (it && it.barcodeValue) + ')');
}

console.log('\n[22] Food menu list is really wired (price typed in the list saves)');
{
  const {E, d} = await fresh();
  const out = E(`(function(){
     var wired = {};
     function fake(kind,id,val,type){ var h={}; wired[kind+id]=h; return {type:type||'text', value:val, checked:false, classList:{add:function(){},remove:function(){}}, getAttribute:function(a){ return a==='data-fe'?kind: a==='data-id'?id:null; }, addEventListener:function(t,f){ h[t]=f; }, blur:function(){}, focus:function(){}, select:function(){}}; }
     var rate = fake('rate','i_ch','260');
     var foodBox = {innerHTML:'', querySelectorAll:function(sel){ return sel==='[data-fe]' ? [rate] : []; }, querySelector:function(){ return null; }};
     var liquorBox = {innerHTML:'', querySelectorAll:function(){ return []; }, querySelector:function(){ return null; }};
     var orig = document.getElementById;
     document.getElementById = function(id){ if(id==='itemListFood') return foodBox; if(id==='itemListLiquor') return liquorBox; return orig.call(document,id); };
     renderItemList();
     document.getElementById = orig;
     if(wired['ratei_ch'] && wired['ratei_ch'].change) wired['ratei_ch'].change();
     return 'ran'; })()`);
  eq(d().items.find(i=>i.id==='i_ch').saleRate, 260, 'rate typed in the food list is saved after renderItemList wires it');
}

console.log('\n' + '='.repeat(50));
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
if(fail){ console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
process.exit(0);
