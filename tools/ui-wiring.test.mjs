// Clicks the real buttons the app draws in lists (the part unit tests usually miss).
import {app, ok, eq, near, section, done} from './flows.mjs';
const today = () => new Date().toISOString().slice(0,10);

section('[U1] Stock screen: group expand, Transfer button, search');
{
  const a = await app();
  a.E(`switchScreen('stock')`);
  const hdr = a.$('stockListLiquor').querySelector('[data-togglestockgroup]');
  ok(!!hdr, 'category header present'); if(hdr) hdr.click();
  const tr = a.$('stockListLiquor').querySelector('[data-transfer]');
  ok(!!tr, 'after expanding, the Transfer button appears');
  if(tr){ const cap = a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; document.getElementById('stockListLiquor').querySelector('[data-transfer]').click(); openFormModal=o; return cap && cap.title; })()`); eq(cap, 'Stock Transfer', 'Transfer opens the transfer dialog'); }
  a.type('stockSearch', 'zzz'); ok(/No liquor items|empty-state/.test(a.$('stockListLiquor').innerHTML), 'search with no match shows an empty state');
}

section('[U2] Reorder alerts → purchase order');
{
  const a = await app(s => { s.items.find(i=>i.id==='i_rs').stockCounter = 0; s.items.find(i=>i.id==='i_rs').stockGodown = 1; });
  a.E(`switchScreen('stock')`);
  ok(/Royal Stag/.test(a.$('reorderAlertsList').innerHTML), 'low-stock item appears in reorder alerts');
  const g = a.$('reorderAlertsList').querySelector('[data-togglereordergroup]');
  ok(!!g, 'reorder group header present');
  const btn = a.h.document.getElementById('btnCreatePoFromAlerts') || a.h.document.querySelector('#reorderAlertsPanel button');
  ok(!!btn, 'create-PO button present');
  if(btn){ btn.click(); ok(a.E(`poCart.length`) >= 1, 'PO cart pre-filled from the selected low-stock items'); }
}

section('[U3] Purchase order list buttons');
{
  const a = await app(s => { s.purchaseOrders.push({id:'po1', poNo:'PO-0001', date:new Date().toISOString(), vendorId:'v1', vendorName:'Sharma Traders', status:'Pending', items:[{itemId:'i_cola', name:'Cola', orderedQty:5, receivedQty:0, rate:20}]},
    {id:'po2', poNo:'PO-0002', date:new Date().toISOString(), vendorId:'v1', vendorName:'Sharma Traders', status:'Cancelled', items:[{itemId:'i_cola', name:'Cola', orderedQty:5, receivedQty:0, rate:20}]}); });
  a.E(`switchScreen('purchaseorders')`);
  const heads = a.$('poList').querySelectorAll('[data-togglepo]'); ok(heads.length >= 2, 'PO group headers present (' + heads.length + ')'); const before = a.E(`!!poListExpanded.Pending`); heads.forEach(h => { if(h.getAttribute('data-togglepo') === 'Pending') h.click(); }); ok(a.E(`!!poListExpanded.Pending`) !== before, 'clicking a group header toggles it');
  a.E(`poListExpanded.Pending = true; poListExpanded.Cancelled = true; renderPoList()`);
  const recv = a.$('poList').querySelector('[data-receivepo]'); ok(!!recv, 'Receive button present');
  if(recv){ recv.click(); ok(a.$('poReceiveOverlay').classList.contains('open'), 'Receive opens the receiving dialog'); a.$('btnCancelPoReceive').click(); ok(!a.$('poReceiveOverlay').classList.contains('open'), 'Cancel closes it'); }
  const del = a.$('poList').querySelector('[data-delpo="po2"]'); ok(!!del, 'cancelled PO shows Delete'); if(del){ del.click(); ok(!a.d().purchaseOrders.some(p=>p.id==='po2'), 'cancelled PO deleted'); }
}

section('[U4] Excise monthly: save physical count');
{
  const a = await app(s => { s.stockLog.push({id:'s1', itemId:'i_rs', itemName:'Royal Stag 750 ml', location:'godown', type:'purchase', qtyChange:10, balanceAfter:10, refId:'p', date:new Date().toISOString()}); });
  a.E(`switchScreen('reports')`);
  a.$('rptExciseMonth').value = today().slice(0,7);
  a.$('exciseMonthlyViewSimple').checked = true; a.$('exciseMonthlyViewFlr4a').checked = false;
  a.$('btnRunExciseMonthly').click();
  const inp = a.$('rptExciseMonthlyResult').querySelector('.excise-recon-input');
  ok(!!inp, 'physical count box present'); 
  if(inp){ inp.value = '9'; const sv = a.$('btnSaveExciseRecon'); ok(!!sv, 'save button present'); sv && sv.click(); const rec = a.d().exciseReconciliation[today().slice(0,7)]; eq(rec && rec['i_rs'], 9, 'physical count saved against the item'); }
}

section('[U5] Liquor item table buttons');
{
  const a = await app();
  a.E(`switchScreen('setup'); menuMode='liquor'; applyMenuMode(); renderItemList();`);
  const box = a.$('itemListLiquor');
  const g = box.querySelector('[data-togglegroup]'); ok(!!g, 'group header'); if(g) g.click();
  const eb = a.$('itemListLiquor').querySelector('[data-editbrand]'); ok(!!eb, 'Edit / Brand Info button');
  const cap = a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; document.getElementById('itemListLiquor').querySelector('[data-editbrand]').click(); document.getElementById('itemListLiquor').querySelector('[data-movecat]').click(); openFormModal=o; return cap && cap.title; })()`);
  ok(/Move Item/.test(cap), 'Edit and Move both open their dialogs (last: ' + cap + ')');
  const rate = a.$('itemListLiquor').querySelector('[data-itemrate="i_rs"]'); ok(!!rate, 'inline rate box');
  if(rate){ rate.value = '2100'; rate.dispatchEvent({type:'change', bubbles:true}); eq(a.d().items.find(i=>i.id==='i_rs').saleRate, 2100, 'inline rate saves'); }
  const fav = a.$('itemListLiquor').querySelector('[data-togglefav="i_rs"]'); if(fav){ fav.click(); ok(a.d().items.find(i=>i.id==='i_rs').isFavorite, 'favourite toggles'); }
  const pc = a.$('itemListLiquor').querySelector('[data-pegcalc="i_rs"]'); ok(!!pc, 'peg calculator button');
  if(pc){ const t = a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; document.getElementById('itemListLiquor').querySelector('[data-pegcalc="i_rs"]').click(); openFormModal=o; return cap && cap.title; })()`); ok(/Peg Rate Calculator/.test(t), 'peg calculator opens'); }
  const bc = a.$('itemListLiquor').querySelector('[data-barcode="i_rs"]'); if(bc){ let good = true; try{ bc.click(); }catch(e){ good = false; } ok(good, 'barcode sticker button runs'); }
}

section('[U6] Food list: category select, code box, stock tick, bulk %');
{
  const a = await app(s => { s.categories.push({id:'cat_main', name:'Main Course', trackStock:false}); });
  a.E(`switchScreen('setup'); menuMode='food'; applyMenuMode(); renderItemList();`);
  const fb = () => a.$('itemListFood');
  const sel = fb().querySelector('select[data-fe="cat"][data-id="i_ch"]'); ok(!!sel, 'category dropdown present');
  if(sel){ sel.value = 'cat_main'; sel.dispatchEvent({type:'change', bubbles:true}); eq(a.d().items.find(i=>i.id==='i_ch').categoryId, 'cat_main', 'changing the dropdown moves the item'); }
  const code = fb().querySelector('[data-fe="code"][data-id="i_ch"]'); if(code){ code.value = 'CH9'; code.dispatchEvent({type:'change', bubbles:true}); eq(a.d().items.find(i=>i.id==='i_ch').itemCode, 'CH9', 'code box saves'); }
  const tk = fb().querySelector('[data-fe="track"][data-id="i_ch"]'); if(tk){ tk.click(); eq(a.d().items.find(i=>i.id==='i_ch').trackStock, true, 'stock tick saves'); }
  const pct = a.$('foodBulkPct'); ok(!!pct, 'bulk % box present');
  if(pct){ pct.value = '10'; const ap = a.$('btnFoodBulkApply'); ap.click(); near(a.d().items.find(i=>i.id==='i_ch').saleRate, 275, 'bulk +10% applies to the listed items'); }
}

section('[U7] Ledger screen buttons');
{
  const a = await app(s => { s.customers[0].balance = 400; });
  a.E(`switchScreen('ledger')`);
  ok(/Amit/.test(a.h.document.getElementById('screen-ledger').innerHTML), 'customer appears in ledger');
  const cp = a.h.document.getElementById('screen-ledger').querySelector('[data-custpay]'); ok(!!cp, 'customer Record Payment button');
  const t = a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; document.getElementById('screen-ledger').querySelector('[data-custpay]').click(); openFormModal=o; return cap && cap.title; })()`);
  ok(/Record Payment from Amit/.test(t), 'opens the payment dialog for that customer');
  const acc = a.h.document.getElementById('screen-ledger').querySelector('[data-custaccount]'); ok(!!acc, 'Account button present');
  if(acc){ let good = true; try{ acc.click(); }catch(e){ good = false; } ok(good, 'Account statement opens without error'); }
}

done();
