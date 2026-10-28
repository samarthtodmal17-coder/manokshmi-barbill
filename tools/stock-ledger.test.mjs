import {app, ok, eq, near, section, done} from './flows.mjs';

const modal = (a, code) => a.E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; }; ${code}; openFormModal=orig; return cap; })()`);

section('[S1] Opening stock, wastage, transfer (through the real buttons)');
{
  const a = await app();
  a.E(`switchScreen('stock')`);
  a.$('openingStockItemSelect').value = 'i_cola'; a.$('openingStockLocation').value = 'counter'; a.type('openingStockQty', '10'); a.type('openingStockDate', '2026-01-01');
  a.$('btnAddOpeningStock').click();
  eq(a.d().items.find(i=>i.id==='i_cola').stockCounter, 30, 'opening stock adds to counter (20 + 10)');
  eq(a.d().openingStockEntries.length, 1, 'opening stock entry recorded');
  a.$('wastageItemSelect').value = 'i_cola'; a.$('wastageLocation').value = 'counter'; a.type('wastageQty', '4'); a.$('wastageReason').value = 'Breakage';
  a.$('btnAddWastage').click();
  eq(a.d().items.find(i=>i.id==='i_cola').stockCounter, 26, 'wastage reduces counter stock');
  a.type('wastageQty', '999'); a.$('btnAddWastage').click();
  ok(a.toasts.some(t=>/Not enough stock/.test(t)), 'wastage larger than stock is refused');
  const cap = modal(a, `promptStockTransfer(data.items.find(i=>i.id==='i_cola'))`);
  eq(cap.onSave({qty: 50}), 'Not enough stock in Godown', 'transfer more than godown holds is refused');
  cap.onSave({qty: 5});
  const cola = a.d().items.find(i=>i.id==='i_cola');
  eq([cola.stockCounter, cola.stockGodown], [31, 0], 'transfer moves 5 from godown to counter');
  eq(cola.stockCounter + cola.stockGodown, 31, 'transfer never changes the total');
}

section('[S2] Deleting wastage / opening stock restores stock');
{
  const a = await app();
  a.E(`switchScreen('stock')`);
  a.$('wastageItemSelect').value = 'i_cola'; a.$('wastageLocation').value = 'counter'; a.type('wastageQty', '4'); a.$('btnAddWastage').click();
  const btn = a.$('wastageList') ? a.$('wastageList').querySelector('[data-delwaste]') : null;
  ok(!!btn, 'wastage list shows a delete button');
  if(btn){ btn.click(); eq(a.d().items.find(i=>i.id==='i_cola').stockCounter, 20, 'deleting wastage puts stock back'); eq(a.d().wastage.length, 0, 'wastage entry removed'); }
}

section('[S3] Bill delete / edit reverse stock and customer balance');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('3*cola'); a.$('posPaymentMode').value = 'Credit'; a.$('posPaymentMode').dispatchEvent({type:'change'}); a.$('posCreditCustomer').value = 'c1';
  a.$('btnSavePrintBill').click();
  const bill = a.d().bills[0];
  eq([a.d().items.find(i=>i.id==='i_cola').stockCounter, a.d().customers[0].balance], [17, 120], 'after credit sale: stock 17, customer owes 120');
  a.E(`switchScreen('history')`);
  const del = a.$('historyList') ? a.$('historyList').querySelector('[data-del]') : null;
  ok(!!del, 'history shows a Delete button');
  if(del){ del.click();
    eq([a.d().items.find(i=>i.id==='i_cola').stockCounter, a.d().customers[0].balance], [20, 0], 'delete restores stock and clears the customer balance');
    ok(a.d().bills[0].deleted, 'bill is kept but marked deleted');
    near(a.E(`billsInRange ? 1 : 1`), 1, 'billsInRange exists');
    const ledger = a.d().customers[0].ledgerEntries || [];
    eq(ledger.reduce((s,e)=>s+e.amount,0), a.d().customers[0].balance, 'customer ledger total equals balance after delete');
  }
}

section('[S4] Payments cannot exceed balance and keep ledger = balance');
{
  const a = await app(s => { s.customers[0].balance = 300; s.vendors[0].balance = 5000; });
  let cap = modal(a, `promptCustomerPayment(data.customers[0])`);
  ok(/more than the outstanding/.test(cap.onSave({amount: 500, mode: 'Cash'})), 'customer cannot pay more than owed');
  eq(a.d().customers[0].balance, 300, 'balance unchanged after refused payment');
  cap.onSave({amount: 100, mode: 'UPI'});
  eq(a.d().customers[0].balance, 200, 'valid customer payment reduces balance');
  cap = modal(a, `promptVendorPayment(data.vendors[0])`);
  ok(/more than the outstanding/.test(cap.onSave({amount: 9999})), 'vendor payment cannot exceed what is owed');
  cap.onSave({amount: 5000, mode: 'Cheque'});
  eq(a.d().vendors[0].balance, 0, 'vendor fully paid');
  ok(a.d().vendors[0].ledgerEntries.every(e=>e.amount !== 0), 'no zero-value ledger rows');
}

section('[S5] Expenses');
{
  const a = await app();
  a.E(`switchScreen('expenses')`);
  a.type('expDate', '2026-10-01'); a.$('expCategory').value = 'Rent'; a.type('expDescription', 'Shop rent'); a.type('expAmount', '12000');
  a.$('btnAddExpense').click();
  eq(a.d().expenses.length, 1, 'expense recorded');
  a.type('expAmount', '-5'); a.$('btnAddExpense').click();
  eq(a.d().expenses.length, 1, 'negative expense refused');
  const del = a.$('expenseHistoryList') && a.$('expenseHistoryList').querySelector('[data-delexp]');
  ok(!!del, 'expense list has a delete button');
  if(del){ del.click(); eq(a.d().expenses.length, 0, 'expense deleted'); }
}

section('[S6] Purchase Order: create, receive, stock + vendor balance + status');
{
  const a = await app();
  a.E(`switchScreen('purchaseorders'); poCart.push({itemId:'i_cola', name:'Cola', qty:10, rate:20}); poCart.push({itemId:'i_rs', name:'Royal Stag 750 ml', qty:4, rate:1600});`);
  a.$('poVendorSelect').value = 'v1'; a.$('btnSavePo').click();
  eq(a.d().purchaseOrders.length, 1, 'PO saved');
  const po = a.d().purchaseOrders[0];
  a.E(`openPoReceiveModal(data.purchaseOrders[0])`);
  const rows = a.$('poReceiveItemsList').querySelectorAll('[data-po-item]');
  eq(rows.length, 2, 'receive dialog lists both lines');
  rows[0].querySelector('.po-recv-qty').value = '10'; rows[1].querySelector('.po-recv-qty').value = '2';
  a.$('poReceivePaymentMode').value = 'Credit';
  a.$('btnSavePoReceive').click();
  const cola = a.d().items.find(i=>i.id==='i_cola'), rs = a.d().items.find(i=>i.id==='i_rs');
  eq([cola.stockGodown, rs.stockGodown], [15, 12], 'godown stock increased by received quantities');
  eq(a.d().purchaseOrders[0].status, 'Partial', 'PO is Partial when one line is short');
  eq(a.d().vendors[0].balance, 5000 + 10*20 + 2*1600, 'vendor balance up by the received value (credit)');
  a.E(`openPoReceiveModal(data.purchaseOrders[0])`);
  a.$('poReceiveItemsList').querySelectorAll('[data-po-item]').forEach(r => { r.querySelector('.po-recv-qty').value = r.getAttribute('data-po-item') === 'i_rs' ? '2' : '0'; });
  a.$('poReceivePaymentMode').value = 'Cash'; a.$('btnSavePoReceive').click();
  eq(a.d().purchaseOrders[0].status, 'Received', 'PO becomes Received after the balance arrives');
}

section('[S7] Deleting a purchase reverses stock; locked once sold');
{
  const a = await app();
  a.E(`switchScreen('purchase'); purCart.push({itemId:'i_cola', name:'Cola', qty:10, rate:20});`);
  a.$('purVendorSelect').value = 'v1'; a.$('purPaymentMode').value = 'Credit'; a.type('purDiscount', '0'); a.type('purTaxPercent', '0');
  a.$('btnSavePurchase').click();
  eq(a.d().items.find(i=>i.id==='i_cola').stockGodown, 15, 'purchase adds to godown');
  const lock = a.E(`purchaseLockReason(data.purchases[0])`);
  eq(lock, '', 'unsold purchase is not locked');
  a.E(`switchScreen('billing'); selectTable('t1')`); a.search('cola'); a.$('btnSavePrintBill').click();
  ok(a.E(`purchaseLockReason(data.purchases[0])`) !== '', 'after the item sells, the purchase is locked');
}

done();
