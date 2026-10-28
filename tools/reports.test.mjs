import {app, ok, eq, near, section, done} from './flows.mjs';

const today = () => new Date().toISOString().slice(0,10);
async function scenario(){
  // stock arrives through real flows so the stock log is complete
  const a = await app(s => { s.items.forEach(i => { if(i.trackStock){ i.stockCounter = 0; i.stockGodown = 0; } }); });
  a.E(`switchScreen('stock')`);
  a.$('openingStockItemSelect').value = 'i_rs'; a.$('openingStockLocation').value = 'godown'; a.type('openingStockQty', '10'); a.type('openingStockDate', '2020-01-01'); a.$('btnAddOpeningStock').click();
  a.$('openingStockItemSelect').value = 'i_cola'; a.$('openingStockLocation').value = 'counter'; a.type('openingStockQty', '50'); a.$('btnAddOpeningStock').click();
  a.E(`promptStockTransfer`); 
  a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; promptStockTransfer(data.items.find(i=>i.id==='i_rs')); openFormModal=o; cap.onSave({qty:6}); })()`);
  // sales: Cash, UPI, Credit; one peg sale
  const sell = (fn, mode, cust) => { a.E(`selectTable('t1')`); fn(); a.$('posPaymentMode').value = mode; a.$('posPaymentMode').dispatchEvent({type:'change'}); if(cust) a.$('posCreditCustomer').value = cust; a.$('btnSavePrintBill').click(); };
  a.E(`switchScreen('billing')`);
  sell(() => { a.search('4*cola'); a.search('2*chicken'); }, 'Cash');                          // 160 + 500 = 660
  sell(() => { a.E(`addPegToCart(data.items.find(i=>i.id==='i_rs'), 60, 200)`); a.E(`addPegToCart(data.items.find(i=>i.id==='i_rs'), 60, 200)`); }, 'UPI');   // 400
  sell(() => { a.search('chicken'); }, 'Credit', 'c1');                                      // 250 credit
  return a;
}

section('[R1] Daily closing');
{
  const a = await scenario();
  eq(a.d().bills.length, 3, 'three bills exist');
  const html = a.E(`buildDailyClosingHtml('${today()}', '${today()}', null, 500)`);
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/Total Sales\s*₹?\s*1,?310/.test(txt), 'total sales = 660 + 400 + 250 = 1310 (' + (txt.match(/Total Sales[^A-Z]{0,25}/)||[''])[0] + ')');
  ok(/Total in Bank \(UPI\/Card\/etc\.\)\s*₹?\s*400\.00/.test(txt), 'bank total counts UPI only, NOT the credit sale (' + (txt.match(/Total in Bank \(UPI\/Card\/etc\.\)[^A-Z]{0,20}/)||[''])[0] + ')');
  ok(/Total Cash in Drawer\s*₹?\s*1,?160/.test(txt), 'drawer = float 500 + cash 660 = 1160');
}

section('[R2] Profit & Loss uses fractional bottle cost for pegs');
{
  const a = await scenario();
  const txt = a.E(`buildPnlHtml('${today()}', '${today()}')`).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // COGS = 4 cola x 25 + 2 pegs x (60/750 x 1500) = 100 + 240 = 340 (chicken has no cost)
  ok(/Cost of Goods Sold\s*-?₹?\s*340\.00/.test(txt), 'COGS = 340 (not 3100): ' + (txt.match(/Cost of Goods Sold[^A-Z]{0,20}/)||[''])[0]);
}

section('[R3] GST vs Excise split adds up to the bill totals');
{
  const a = await scenario();
  const t = a.E(`gstSplitSummary('${today()}', '${today()}')`);
  near(t.exciseRev + t.otherRev, t.grandTotal, 'excise + other revenue = grand total');
  near(t.exciseRev, 400, 'liquor revenue = the two pegs (400)');
}

section('[R4] Excise register: opening + receipts - sales - wastage = closing, and closing = stock on hand');
{
  const a = await scenario();
  const p = a.E(`exciseItemPeriod('i_rs', '${today()}', '${today()}')`);
  near(p.opening, 10, 'opening (from the dated opening-stock entry) = 10');
  near(p.sales, 120/750, 'sales = 2 pegs of 60 ml = 0.16 bottle');
  near(p.opening + p.receipts - p.sales - p.wastage, p.closing, 'register arithmetic balances');
  const it = a.d().items.find(i=>i.id==='i_rs');
  near(p.closing, (it.stockCounter||0) + (it.stockGodown||0), 'register closing equals counter + godown stock');
  const w = a.E(`exciseItemPeriodWhole('i_rs', '${today()}', '${today()}')`);
  eq([w.opening, w.closing], [10, 10], 'whole-bottle register: partly used bottle still counts as a bottle in stock');
}

section('[R5] Customer ledger statement = balance');
{
  const a = await scenario();
  const c = a.d().customers[0];
  eq(c.balance, 250, 'customer owes the credit bill');
  eq((c.ledgerEntries||[]).reduce((s,e)=>s+e.amount,0), 250, 'ledger entries add up to the balance');
}

section('[R6] Every report builder runs on realistic data without errors');
{
  const a = await scenario();
  const calls = [
    `buildDailyClosingHtml('${today()}','${today()}',1000,500)`, `buildPnlHtml('${today()}','${today()}')`, `buildClosingStockHtml()`, `buildCashDistHtml()`,
    `buildExciseTableHtml('${today()}','${today()}',{})`, `gstSplitSummary('${today()}','${today()}')`
  ];
  for(const c of calls){ let good = true, out; try{ out = a.E(c); }catch(e){ good = false; out = e.message; } ok(good, c.slice(0,45) + (good ? '' : '  -> ' + out)); }
  for(const id of ['btnRunItemReport','btnRunCatReport','btnRunBestReport','btnRunPnl','btnRunDailyClosing','btnRunExciseDaily','btnRunExciseMonthly','btnRunGstSplit']){
    let good = true, msg = '';
    for(const f of ['rptItemFrom','rptItemTo','rptCatFrom','rptCatTo','rptBestFrom','rptBestTo','rptPnlFrom','rptPnlTo','rptClosingDate','rptClosingDateTo','rptExciseDate','rptSplitFrom','rptSplitTo']) a.$(f).value = today();
    a.$('rptExciseMonth').value = today().slice(0,7);
    try{ a.$(id).click(); }catch(e){ good = false; msg = e.message; }
    ok(good, 'report button #' + id + (good ? '' : ' -> ' + msg));
  }
  ok(a.$('rptItemResult').innerHTML.length > 50, 'item-wise report produced output');
  ok(/Royal Stag/.test(a.$('rptExciseDailyResult').innerHTML), 'excise daily register lists Royal Stag');
}

section('[R7] Cash recovered from customers / paid to vendors moves the drawer');
{
  const a = await app(s => { s.customers[0].balance = 400; s.customers[0].ledgerEntries=[{id:'x', date:new Date().toISOString(), type:'sale', amount:400, note:'Bill'}]; s.vendors[0].balance = 1000; });
  const pay = (kind, amt, mode) => a.E(`(function(){ var cap; var o=openFormModal; openFormModal=function(x){cap=x;}; ${kind==='c'?'promptCustomerPayment(data.customers[0])':'promptVendorPayment(data.vendors[0])'}; openFormModal=o; cap.onSave({amount:${amt}, mode:${JSON.stringify(mode)}}); })()`);
  pay('c', 300, 'Cash'); pay('c', 50, 'UPI'); pay('v', 200, '');
  const txt = a.E(`buildDailyClosingHtml('${new Date().toISOString().slice(0,10)}','${new Date().toISOString().slice(0,10)}',null,500)`).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  ok(/Credit Recovered \(cash\)\s*₹?\s*300\.00/.test(txt), 'cash recovered from the customer is listed (not the UPI part)');
  ok(/Vendor Payments \(cash\)\s*₹?\s*200\.00/.test(txt), 'cash paid to the vendor is listed');
  ok(/Total Cash in Drawer\s*₹?\s*600\.00/.test(txt), 'drawer = 500 float + 300 recovered - 200 vendor = 600 (' + (txt.match(/Total Cash in Drawer[^A-Z]{0,20}/)||[''])[0] + ')');
}

done();
