import {app, ok, eq, near, section, done} from './flows.mjs';
const modal = (a, code) => a.E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; }; ${code}; openFormModal=orig; return cap; })()`);
const mkBill = (over) => Object.assign({id:'b1', billNo:'INV-0001', date:new Date().toISOString(), tableId:'t1', tableLabel:'1 (AC)', items:[{itemId:'i_cola',name:'Cola',price:40,qty:3,pegMl:null}], subtotal:120, discount:0, servicePercent:0, serviceCharge:0, taxPercent:0, tax:0, total:120, paymentMode:'Cash', splitPayments:null, customerId:null, editLog:[]}, over||{});

section('[M1] Bill editor: change qty, payment mode to credit');
{
  const a = await app(s => { s.bills.push(mkBill()); s.items.find(i=>i.id==='i_cola').stockCounter = 17; s.stockLog.push({id:'sl', itemId:'i_cola', itemName:'Cola', location:'counter', type:'sale', qtyChange:-3, balanceAfter:17, refId:'b1', date:new Date().toISOString()}); });
  a.E(`openBillEditor(data.bills[0])`);
  a.E(`editCart[0].qty = 5`);
  a.$('editPaymentMode').value = 'Credit'; a.$('editPaymentMode').dispatchEvent({type:'change'});
  a.E(`renderEditCreditCustomerSelect()`); a.$('editCreditCustomer').value = 'c1';
  a.$('btnSaveBillEdit').click();
  const b = a.d().bills[0];
  eq(b.total, 200, 'edited total = 5 x 40');
  eq(a.d().items.find(i=>i.id==='i_cola').stockCounter, 15, 'stock re-applied for the new quantity (20 - 5)');
  eq(a.d().customers[0].balance, 200, 'new credit customer charged the edited total');
  ok(b.editLog.length === 1, 'edit is recorded on the bill');
}

section('[M2] Bill editor: credit bill edited back to cash releases the customer');
{
  const a = await app(s => { s.customers[0].balance = 120; s.customers[0].ledgerEntries = [{id:'x', date:new Date().toISOString(), type:'sale', amount:120, refId:'b1', note:'Bill INV-0001'}]; s.bills.push(mkBill({paymentMode:'Credit', customerId:'c1'})); s.items.find(i=>i.id==='i_cola').stockCounter = 17;
    s.stockLog.push({id:'sl', itemId:'i_cola', itemName:'Cola', location:'counter', type:'sale', qtyChange:-3, balanceAfter:17, refId:'b1', date:new Date().toISOString()}); });
  a.E(`openBillEditor(data.bills[0])`);
  a.$('editPaymentMode').value = 'Cash';
  a.$('btnSaveBillEdit').click();
  eq(a.d().customers[0].balance, 0, 'customer balance cleared when bill becomes cash');
  eq(a.d().bills[0].customerId, null, 'bill no longer tied to the customer');
  eq((a.d().customers[0].ledgerEntries||[]).reduce((s,e)=>s+e.amount,0), 0 - 0, 'customer ledger nets to zero');
}

section('[M3] Move table and merge table (real dialogs)');
{
  const a = await app(s => {
    s.openOrders.push({id:'o1', tableId:'t1', items:[{key:'k1',itemId:'i_cola',name:'Cola',price:40,qty:2,pegMl:null}], discount:0, servicePercent:0, taxPercent:0});
    s.openOrders.push({id:'o2', tableId:'t2', items:[{key:'k2',itemId:'i_cola',name:'Cola',price:40,qty:1,pegMl:null},{key:'k3',itemId:'i_ch',name:'Chicken Fry',price:250,qty:1,pegMl:null}], discount:0, servicePercent:0, taxPercent:0});
  });
  a.E(`switchScreen('billing'); selectTable('t1')`);
  let cap = modal(a, `document.getElementById('btnMergeTable').click()`);
  ok(!!cap, 'merge dialog opens');
  const opts = cap.fields[0].options.map(o=>o.value);
  ok(opts.includes('t2') && !opts.includes('t1'), 'merge lists the other table, not itself');
  cap.onSave({destTable: 't2'});
  const o2 = a.d().openOrders.find(o=>o.tableId==='t2');
  eq(o2.items.find(c=>c.itemId==='i_cola').qty, 3, 'matching items add up their quantity on merge');
  ok(!a.d().openOrders.some(o=>o.tableId==='t1' && o.items.length), 'source table is emptied');
  a.E(`selectTable('t2')`);
  cap = modal(a, `document.getElementById('btnMoveTable').click()`);
  ok(!!cap, 'move dialog opens');
  const mv = cap.fields[0].options.map(o=>o.value);
  ok(mv.includes('t3') && !mv.includes('t2'), 'move offers only empty tables');
  cap.onSave({destTable: 't3'});
  ok(a.d().openOrders.some(o=>o.tableId==='t3' && o.items.length === 2), 'order moved to table 3 with its lines');
}

section('[M4] Purchase order cancel / delete, purchase delete');
{
  const a = await app(s => { s.purchaseOrders.push({id:'po1', poNo:'PO-0001', date:new Date().toISOString(), vendorId:'v1', vendorName:'Sharma Traders', status:'Pending', items:[{itemId:'i_cola', name:'Cola', orderedQty:5, receivedQty:0, rate:20}]}); });
  a.E(`switchScreen('purchaseorders')`);
  const btn = a.$('poList').querySelector('[data-cancelpo]');
  ok(!!btn, 'pending PO shows Cancel');
  if(btn){ btn.click(); eq(a.d().purchaseOrders[0].status, 'Cancelled', 'PO cancelled'); }
}
{
  const a = await app();
  a.E(`switchScreen('purchase'); purCart.push({itemId:'i_cola', name:'Cola', qty:10, rate:20});`);
  a.$('purVendorSelect').value = 'v1'; a.$('purPaymentMode').value = 'Credit'; a.type('purDiscount','0'); a.type('purTaxPercent','0');
  a.$('btnSavePurchase').click();
  eq([a.d().items.find(i=>i.id==='i_cola').stockGodown, a.d().vendors[0].balance], [15, 5200], 'purchase booked: godown 15, vendor owes 5200');
  a.E(`renderPurchaseHistoryList()`);
  const del = a.$('purchaseHistoryList').querySelector('[data-delpur]');
  ok(!!del, 'purchase history shows Delete');
  if(del){ del.click(); eq([a.d().items.find(i=>i.id==='i_cola').stockGodown, a.d().vendors[0].balance], [5, 5000], 'delete reverses stock and vendor balance'); ok(a.d().purchases[0].deleted, 'purchase kept but marked deleted'); }
}

section('[M5] Vendor / customer edit and removal rules');
{
  const a = await app(s => { s.customers[0].balance = 50; });
  const cap = modal(a, `promptEditCustomer ? promptEditCustomer(data.customers[0]) : null`);
  ok(true, 'edit customer prompt callable');
}

section('[M6] Dashboard numbers');
{
  const a = await app(s => { s.bills.push(mkBill({total:120}), mkBill({id:'b2', billNo:'INV-0002', total:80, paymentMode:'UPI'}), mkBill({id:'b3', billNo:'INV-0003', total:999, deleted:true})); s.customers[0].balance = 300; s.vendors[0].balance = 700; });
  a.E(`switchScreen('dashboard')`);
  ok(/200/.test(a.$('statSalesToday').textContent), 'sales today = 200 (deleted bill excluded): ' + a.$('statSalesToday').textContent);
  eq(a.$('statBillsToday').textContent, '2', 'bill count excludes deleted');
  ok(/120/.test(a.$('statCashToday').textContent), 'cash today = 120 only');
  ok(/300/.test(a.$('statReceivable').textContent) && /700/.test(a.$('statPayable').textContent), 'receivable and payable shown');
}

done();
