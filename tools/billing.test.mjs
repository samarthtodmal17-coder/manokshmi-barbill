import {app, ok, eq, near, section, done} from './flows.mjs';

section('[B1] Table + item entry by typing / barcode / qty prefix');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('2*cola');
  eq(a.d().openOrders[0] && a.d().openOrders[0].items[0] && a.d().openOrders[0].items[0].qty, 2, '"2*cola"+Enter adds 2 Cola');
  a.search('1004');
  eq(a.d().openOrders[0].items.find(c=>c.itemId==='i_cola').qty, 3, 'scanning barcode 1004 adds one more Cola');
  a.search('chicken');
  ok(a.d().openOrders[0].items.some(c=>c.itemId==='i_ch'), 'name search "chicken"+Enter adds Chicken Fry');
  a.search('zzzz');
  ok(a.toasts.some(t=>/No item matches/.test(t)), 'unknown text tells the cashier no item matches');
}

section('[B2] Cart buttons (+ / - / remove / manual rate) really work');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('cola');
  const row = () => a.$('posCartList').querySelector('.cart-row');
  row().querySelector('[data-act="inc"]').click();
  eq(a.d().openOrders[0].items[0].qty, 2, '+ button increases qty');
  row().querySelector('[data-act="dec"]').click();
  eq(a.d().openOrders[0].items[0].qty, 1, '- button decreases qty');
  const rate = row().querySelector('.cart-rate'); rate.value = '55'; rate.dispatchEvent({type:'input'}); rate.dispatchEvent({type:'change'});
  eq(a.d().openOrders[0].items[0].price, 55, 'typing a rate in the line changes the price');
  ok(a.d().auditLog.some(x=>x.action==='Rate changed'), 'manual rate is flagged in activity log');
  row().querySelector('.rm').click();
  eq(a.d().openOrders.length === 0 || a.d().openOrders[0].items.length === 0, true, '× removes the line');
}

section('[B3] Totals: discount, service charge, tax');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('2*chicken');
  a.type('posDiscount', '50'); a.type('posServicePercent', '10'); a.type('posTaxPercent', '5');
  const o = a.d().openOrders[0];
  near(a.E(`orderTotal(currentOrder()).total`), (500-50)*1.10*1.05, 'total = (subtotal - discount) + 10% service + 5% tax');
  ok(/519/.test(a.$('posTotal').textContent), 'on-screen total shows ' + a.$('posTotal').textContent);
}

section('[B4] Save bill: cash, stock, numbering');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('3*cola'); a.$('posPaymentMode').value = 'Cash';
  a.$('btnSavePrintBill').click();
  const b = a.d().bills[0];
  ok(!!b, 'bill saved'); 
  if(b){
    eq(b.total, 120, 'bill total 3 x 40'); eq(b.paymentMode, 'Cash', 'payment mode Cash');
    eq(a.d().items.find(i=>i.id==='i_cola').stockCounter, 17, 'counter stock reduced 20 → 17');
    eq(a.d().openOrders.length, 0, 'running order cleared after billing');
    ok(/-0001$/.test(b.billNo), 'first bill number ends 0001 (' + b.billNo + ')');
    eq(a.d().stockLog.filter(e=>e.refId===b.id).length, 1, 'one stock-log entry tied to the bill');
  }
  a.E(`selectTable('t1')`); a.search('cola'); a.$('btnSavePrintBill').click();
  ok(/-0002$/.test(a.d().bills[1].billNo), 'second bill is numbered 0002');
}

section('[B5] Peg sale deducts a fraction of the bottle');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1'); addPegToCart(data.items.find(i=>i.id==='i_rs'), 60, 200); addPegToCart(data.items.find(i=>i.id==='i_rs'), 60, 200);`);
  a.$('posPaymentMode').value = 'Cash'; a.$('btnSavePrintBill').click();
  near(a.d().items.find(i=>i.id==='i_rs').stockCounter, 5 - 2*60/750, '2 x 60 ml deducts 0.16 bottle');
  eq(a.d().bills[0].total, 400, 'two 60 ml pegs billed at 200 each');
}

section('[B6] Credit sale rules');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('2*chicken'); a.$('posPaymentMode').value = 'Credit'; a.$('posPaymentMode').dispatchEvent({type:'change'});
  a.$('btnSavePrintBill').click();
  ok(a.toasts.some(t=>/Select a customer/.test(t)), 'credit without customer is refused');
  eq(a.d().bills.length, 0, 'no bill created on refusal');
  a.$('posCreditCustomer').value = 'c1';
  a.$('btnSavePrintBill').click();           // 500 > limit 1000? no -> allowed
  eq(a.d().bills.length, 1, 'credit sale within limit saved');
  eq(a.d().customers[0].balance, 500, 'customer balance increased by bill total');
  a.E(`selectTable('t2')`); a.search('3*chicken'); a.$('posPaymentMode').value = 'Credit'; a.$('posCreditCustomer').value = 'c1';
  const dl = a.dialogs.length; a.$('btnSavePrintBill').click();
  ok(a.dialogs.slice(dl).some(x=>/over the limit/.test(x)), 'over-limit credit asks for confirmation');
}

section('[B7] Split payment validation');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('2*chicken'); a.$('posSplitEnabled').checked = true; a.$('posSplitEnabled').dispatchEvent({type:'change'});
  a.$('posSplitAmt1').value = '300'; a.$('posSplitAmt2').value = '100';   // typed straight in, no auto-balance
  a.$('btnSavePrintBill').click();
  ok(a.toasts.some(t=>/Split amounts don't match/.test(t)), 'wrong split total refused');
  a.type('posSplitAmt1', '300');
  near(parseFloat(a.$('posSplitAmt2').value), 200, 'typing the first split amount auto-fills the balance in the second');
  a.$('posSplitMode1').value = 'Cash'; a.$('posSplitMode2').value = 'UPI';
  a.$('btnSavePrintBill').click();
  eq(a.d().bills[0] && a.d().bills[0].paymentMode, 'Split', 'valid split saved');
}

section('[B8] KOT sends only new food lines');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('chicken'); a.search('cola'); a.E(`addItemToCart(data.items.find(i=>i.id==='i_rs'))`);
  a.$('btnPrintKot').click();
  const o = a.d().openOrders[0];
  ok(o.kotSent && o.kotSent.i_ch === 1 && o.kotSent.i_cola === 1 && !('i_rs' in o.kotSent), 'food & soft drink go to the kitchen, liquor never does');
  a.$('btnPrintKot').click();
  ok(a.toasts.some(t=>/Nothing new to send/.test(t)), 'second KOT press: nothing new to send');
}

section('[B9] Move / merge table');
{
  const a = await app(s => { s.openOrders.push({id:'o1', tableId:'t1', items:[{key:'k',itemId:'i_cola',name:'Cola',price:40,qty:2}], discount:0}); s.openOrders.push({id:'o2', tableId:'t2', items:[{key:'k2',itemId:'i_cola',name:'Cola',price:40,qty:1}], discount:0}); });
  const r = a.E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){cap=o;}; selectTable('t1'); document.getElementById('btnMergeTable').click(); openFormModal=orig; return cap ? cap.fields.map(function(f){return f.key;}) : null; })()`);
  ok(Array.isArray(r), 'merge dialog opens (' + JSON.stringify(r) + ')');
}

done();
