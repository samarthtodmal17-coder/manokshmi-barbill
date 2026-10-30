// UX layer: attention strip, setup guide, save indicator, text size, shortcuts, labels.
import {app, ok, eq, near, section, done} from './flows.mjs';
section('[X1] Dashboard attention strip');
{
  const a = await app(s => { s.items.find(i=>i.id==='i_rs').stockCounter = 0; s.items.find(i=>i.id==='i_rs').stockGodown = 0; s.vendors[0] && (s.vendors[0].balance = 500); });
  a.E(`switchScreen('dashboard')`);
  const h = a.$('dashAttention').innerHTML;
  ok(/low \/ out of stock/.test(h), 'low-stock chip shown');
  ok(/to pay vendors/.test(h), 'vendor dues chip shown');
  const chip = a.$('dashAttention').querySelector('[data-go="stock"]'); ok(!!chip, 'chip is clickable'); if(chip) chip.click();
  ok(a.E(`document.getElementById('screen-stock').classList.contains('active')`), 'click opens the Stock screen');
}
section('[X2] All clear / setup guide');
{
  const a = await app(s => { s.items.forEach(i=>i.trackStock=false); s.vendors.forEach(v=>v.balance=0); s.customers.forEach(c=>c.balance=0); s.bills=[]; s.openOrders=[]; s.purchaseOrders=[]; });
  a.E(`switchScreen('dashboard')`);
  ok(/Get started/.test(a.$('dashGuide').innerHTML), 'first-run guide shown when no bills yet');
}
section('[X3] Save indicator, text size, shortcuts');
{
  const a = await app();
  a.E(`markSaveState('saved')`); ok(/Saved \d\d:\d\d/.test(a.$('saveState').textContent), 'shows Saved HH:MM');
  a.E(`markSaveState('error')`); ok(/NOT SAVED/.test(a.$('saveState').textContent), 'shows error when save fails');
  a.$('btnTextBigger').click(); eq(a.E(`document.body.style.zoom`), 1.1, 'A+ enlarges text');
  a.$('btnTextSmaller').click(); a.$('btnTextSmaller').click(); eq(a.E(`document.body.style.zoom`), 0.9, 'A- shrinks text');
  a.$('btnKeysHelp').click(); ok(!!a.$('keysOverlay'), '? opens shortcut sheet');
  a.$('btnKeysClose').click(); ok(!a.$('keysOverlay'), 'Close hides it');
}
section('[X5] Cash received / change due');
{
  const a = await app();
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); a.search('cola');
  const tot = a.E(`posLastTotal`); ok(tot > 0, 'bill has a total');
  ok(a.$('posChangeBox').style.display !== 'none', 'cash box visible for Cash');
  a.$('posTendered').value = String(tot + 50); a.$('posTendered').dispatchEvent({type:'input', bubbles:true});
  ok(/Change/.test(a.$('posChangeOut').textContent), 'shows change due');
  a.$('posTendered').value = String(tot - 1); a.$('posTendered').dispatchEvent({type:'input', bubbles:true});
  ok(/Short/.test(a.$('posChangeOut').textContent), 'shows shortfall');
  a.E(`setPayMode('UPI')`); ok(a.$('posChangeBox').style.display === 'none', 'hidden for UPI');
}
section('[X6] One-tap favourites grid');
{
  const a = await app(s => { s.items.forEach(i=>i.isFavorite=false); s.items.find(i=>i.id==='i_rs').isFavorite = true; });
  a.E(`switchScreen('billing')`); a.E(`renderBillingScreen()`);
  const btns = a.$('posFavChips').querySelectorAll('.fav-btn');
  ok(btns.length >= 1, 'favourite buttons rendered (' + btns.length + ')');
  ok(/Royal Stag/.test(a.$('posFavChips').innerHTML), 'starred item shown first');
  // one-tap add of a non-peg item
  const b = await app(s => { s.items.forEach(i=>i.isFavorite=false); const f = s.items.find(i=>!(i.pegPrices&&i.pegPrices.length) && i.saleRate>0 && i.categoryId!=='cat_liq'); f.isFavorite = true; globalThis.__fid = f.id; });
  b.E(`switchScreen('billing')`); b.E(`selectTable('t1')`); b.E(`renderBillingScreen()`);
  const btn = b.$('posFavChips').querySelector('.fav-btn'); ok(!!btn, 'button present');
  const n0 = b.E(`(currentOrder()&&currentOrder().items||[]).length`);
  btn.click();
  ok(b.E(`currentOrder().items.length`) === n0 + 1, 'one tap adds the item to the bill');
  // top sellers must NOT be pulled into favourites
  const c = await app(s => { s.items.forEach(i=>i.isFavorite=false); const it = s.items[0]; s.bills.push({id:'b1', billNo:'1', date:new Date().toISOString(), items:[{itemId:it.id, name:it.name, price:it.saleRate, qty:5}], total:it.saleRate*5, paymentMode:'Cash'}); });
  c.E(`switchScreen('billing')`); c.E(`renderBillingScreen()`);
  eq(c.$('posFavChips').querySelectorAll('.fav-btn').length, 0, 'best sellers are not auto-added to favourites');
  ok(c.$('posFavRow').style.display === 'none', 'favourites row hidden when nothing is starred');
}
section('[X7] Custom confirm dialog');
{
  const mk = async () => { const a = await app(); a.E(`window.__customConfirm = true`); a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); a.search('cola'); return a; };
  const a = await mk();
  const n0 = a.E(`currentOrder().items.length`); ok(n0 > 0, 'bill has lines');
  a.$('btnClearCart').click();
  ok(!!a.$('confirmOverlay'), 'custom dialog appears instead of the native one');
  ok(!a.dialogs.some(d => /CONFIRM/.test(d)), 'native confirm not used');
  eq(a.E(`currentOrder().items.length`), n0, 'nothing cleared until confirmed');
  a.$('btnConfirmNo').click();
  ok(!a.$('confirmOverlay'), 'Cancel closes it'); eq(a.E(`currentOrder().items.length`), n0, 'Cancel keeps the bill');
  a.$('btnClearCart').click(); a.$('btnConfirmYes').click();
  ok(!a.$('confirmOverlay'), 'Confirm closes it');
  eq(a.E(`(currentOrder()&&currentOrder().items||[]).length`), 0, 'Confirm performs the action');
  // item delete in Setup has chained confirms
  const b = await app(); b.E(`window.__customConfirm = true`);
  b.E(`(function(){ var x=document.createElement('button'); x.id='tmpB'; document.body.appendChild(x); window.__runs=0; window.__done=0; x.addEventListener('click', function(){ window.__runs++; if(!confirm('one')) return; if(!confirm('two')) return; window.__done++; }); })()`);
  b.$('tmpB').click(); ok(!!b.$('confirmOverlay'), 'first of two chained confirms shown');
  b.$('btnConfirmYes').click(); ok(!!b.$('confirmOverlay') && b.E(`window.__done`) === 0, 'second confirm shown after first accepted');
  b.$('btnConfirmYes').click(); eq(b.E(`window.__done`), 1, 'action runs exactly once after both accepted');
  ok(!b.$('confirmOverlay'), 'no dialog left open');
  b.$('tmpB').click(); b.$('btnConfirmNo').click(); b.$('tmpB').click(); ok(!!b.$('confirmOverlay'), 'after Cancel, a fresh click asks again');
}
section('[X8] Sortable tables + table timers');
{
  const a = await app();
  a.E(`document.body.insertAdjacentHTML('beforeend', '<table id="tT"><thead><tr><th>Name</th><th>Amt</th></tr></thead><tbody><tr><td>b</td><td>\u20B9 1,200.00</td></tr><tr><td>a</td><td>\u20B9 90.00</td></tr><tr><td>c</td><td>\u20B9 5,000.00</td></tr></tbody></table>')`);
  const th = a.h ? null : null;
  const t = a.$('tT'); const heads = t.querySelectorAll('th'); const col = () => Array.from(t.querySelectorAll('tbody tr')).map(r => r.children[1].textContent);
  heads[1].click(); eq(col().join('|'), ['\u20B9 90.00','\u20B9 1,200.00','\u20B9 5,000.00'].join('|'), 'numeric ascending (not text order)');
  heads[1].click(); eq(col()[0], '\u20B9 5,000.00', 'second click reverses');
  heads[0].click(); eq(Array.from(t.querySelectorAll('tbody tr')).map(r=>r.children[0].textContent).join(''), 'abc', 'text column sorts A-Z');
  // table timer
  const b = await app(); b.E(`switchScreen('billing')`); b.E(`selectTable('t1')`); b.search('cola');
  b.E(`currentOrder().startedAt = Date.now() - 95*60000; renderPosTableMap()`);
  ok(/1h 3\dm/.test(b.$('posTableMap').innerHTML), 'occupied table tile shows time seated');
  ok(/t-time long/.test(b.$('posTableMap').innerHTML), 'turns red after 90 minutes');
}
section('[X9] Date chips + close-the-day wizard');
{
  const a = await app();
  const chips = a.$('expFrom').parentNode.parentNode.parentNode.querySelectorAll('.date-chips button');
  ok(chips.length === 6, 'date chips added to the expenses filter (' + chips.length + ')');
  const today = a.E(`localDateKey(businessNow())`);
  const yBtn = Array.from(chips).find(b => b.textContent === 'Yesterday'); yBtn.click();
  const y = a.$('expFrom').value; ok(y && y < today && a.$('expTo').value === y, 'Yesterday sets both dates');
  Array.from(chips).find(b => b.textContent === 'This month').click();
  eq(a.$('expFrom').value, today.slice(0,8) + '01', 'This month starts on the 1st'); eq(a.$('expTo').value, today, 'ends today');
  Array.from(chips).find(b => b.textContent === 'All').click(); eq(a.$('expFrom').value, '', 'All clears the dates');
  const rc = a.$('rptClosingDate').parentNode.parentNode.parentNode.querySelectorAll('.date-chips button');
  Array.from(rc).find(b => b.textContent === 'Today').click(); eq(a.$('rptClosingDateTo').value, '', 'closing report: Today leaves To blank');

  // wizard
  const b = await app(); b.E(`switchScreen('billing')`); b.E(`selectTable('t1')`); b.search('cola');
  const tot = b.E(`orderTotal(currentOrder()).total`);
  b.$('btnSavePrintBill').click(); b.runTimers && b.runTimers();
  b.E(`switchScreen('dashboard')`);
  ok(b.$('chipCloseDay'), 'dashboard nudges: day not closed');
  b.$('btnClosingWizard').click(); ok(b.$('wizOverlay'), 'wizard opens');
  b.$('wizNext').click(); b.$('wizNext').click();
  ok(b.$('wizCounted'), 'step 3 asks for counted cash');
  const exp = b.E(`lastClosingFigures && lastClosingFigures.expected`);
  b.$('wizCounted').value = String(exp - 20); b.$('wizCounted').dispatchEvent({type:'input', bubbles:true});
  ok(/Short/.test(b.$('wizVar').textContent), 'live variance shows Short');
  b.$('wizNext').click(); ok(/Short/.test(b.$('wizOverlay').innerHTML), 'summary shows the shortage');
  b.$('wizNext').click();
  ok(!b.$('wizOverlay'), 'wizard closes');
  eq(b.E(`data.business.lastClosedDate`), b.E(`localDateKey(businessNow())`), 'day marked closed');
  ok(b.E(`data.auditLog.some(function(x){ return x.action === 'Day closed'; })`), 'closing recorded in the audit log');
  ok(/Total Sales/.test(b.$('rptClosingResult').innerHTML), 'report opened with the result');
  b.E(`switchScreen('dashboard')`); ok(!b.$('chipCloseDay'), 'nudge gone after closing');
}
section('[X10] Undo after a confirmed delete');
{
  const a = await app(); a.E(`window.__customConfirm = true`);
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); a.search('cola'); a.E(`saveData(['openOrders'])`);
  const n0 = a.E(`currentOrder().items.length`);
  a.$('btnClearCart').click(); a.$('btnConfirmYes').click();
  eq(a.E(`(currentOrder()&&currentOrder().items||[]).length`), 0, 'bill cleared');
  ok(a.$('undoBar') && a.$('undoBar').style.display === 'flex', 'Undo bar appears');
  a.$('btnUndo').click();
  eq(a.E(`currentOrder().items.length`), n0, 'Undo brings the bill lines back');
  ok(a.E(`data.auditLog.some(function(x){return x.action==='Undo';})`), 'undo is audit-logged');
  // refused when something else changed afterwards
  a.$('btnClearCart').click(); a.$('btnConfirmYes').click();
  a.E(`saveData(['expenses'])`);
  a.$('btnUndo').click();
  eq(a.E(`(currentOrder()&&currentOrder().items||[]).length`), 0, 'undo refused after other saves (no silent overwrite)');
  ok(a.toasts.some(t => /Can't undo/.test(t)), 'user told why');
}
section('[X11] Undo a deleted bill restores stock exactly');
{
  const a = await app(); a.E(`window.__customConfirm = true`);
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); a.search('cola'); a.$('btnSavePrintBill').click();
  const snapStock = () => a.E(`JSON.stringify(data.items.map(function(i){return [i.id,i.stockCounter,i.stockGodown];}))`);
  const afterSale = snapStock(); const billId = a.E(`data.bills[data.bills.length-1].id`);
  a.E(`switchScreen('history')`);
  const del = a.$('historyList').querySelector('[data-del="' + billId + '"]'); ok(!!del, 'delete button present');
  del.click(); a.$('btnConfirmYes').click();
  ok(a.E(`data.bills.find(function(b){return b.id==='${billId}';}).deleted`), 'bill marked deleted');
  a.$('btnUndo').click();
  ok(!a.E(`data.bills.find(function(b){return b.id==='${billId}';}).deleted`), 'Undo un-deletes the bill');
  eq(snapStock(), afterSale, 'stock is exactly as it was before the delete');
}
section('[X12] Opening stock: opened (loose) bottles count as full bottles');
{
  const a = await app();
  a.E(`switchScreen('stock')`);
  const id = a.E(`data.items.filter(function(i){return i.bottleSize && i.trackStock;})[0].id`);
  const stock = () => a.E(`data.items.find(function(i){return i.id==='${id}';}).stockCounter`);
  const before = stock();
  const run = (sealed, opened) => { a.$('openingStockItemSelect').value = id; a.$('openingStockLocation').value = 'counter'; a.$('openingStockQty').value = sealed; a.$('openingStockLooseCount').value = opened; a.$('openingStockDate').value = '2026-10-01'; a.$('btnAddOpeningStock').click(); };
  run('2', '1');
  eq(stock() - before, 3, '2 sealed + 1 opened bottle = 3 bottles in stock');
  run('', '2'); eq(stock() - before, 5, 'opened bottles alone work (+2)');
  ok(a.E(`data.openingStockEntries.some(function(e){return /opened bottle.*counted as full/.test(e.notes);})`), 'entry notes record it');
}
section('[X13] Reports unchanged; stock only drops by a whole bottle when a bottle is finished');
{
  const a = await app(s => { const it = s.items.find(i=>i.id==='i_rs'); it.stockCounter = 0; it.stockGodown = 0; s.stockLog = []; s.openingStockEntries = []; s.bills = []; });
  a.E(`switchScreen('stock')`);
  const day = a.E(`localDateKey(businessNow())`);
  a.$('openingStockItemSelect').value = 'i_rs'; a.$('openingStockLocation').value = 'counter'; a.$('openingStockQty').value = '2'; a.$('openingStockLooseCount').value = '1'; a.$('openingStockDate').value = day; a.$('btnAddOpeningStock').click();
  const item = () => a.E(`data.items.find(function(i){return i.id==='i_rs';})`);
  const show = () => { a.E(`renderStockScreen()`); Array.from(a.$('stockListLiquor').querySelectorAll('[data-togglestockgroup]')).forEach(h => h.click()); return a.$('stockListLiquor').innerHTML; };
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`);
  a.E(`addPegToCart(data.items.find(function(i){return i.id==='i_rs';}), 60, 200)`); a.$('btnSavePrintBill').click();
  eq(a.E(`qtyDisp(data.items.find(function(i){return i.id==='i_rs';}), data.items.find(function(i){return i.id==='i_rs';}).stockCounter)`), '3', 'after one peg the screen still shows 3 bottles (bottle not finished)');
  a.E(`switchScreen('stock')`);
  ok(/>3</.test(show()), 'stock table shows 3');
  const p = a.E(`exciseItemPeriod('i_rs', '${day}', '${day}')`);
  near(p.opening, 3, 'register opening = 3 bottles'); near(p.sales, 60 / a.E(`parseSizeMl(data.items.find(function(i){return i.id==='i_rs';}).bottleSize)`), 'register still records the exact peg');
  near(p.opening + p.receipts - p.sales - p.wastage, p.closing, 'register arithmetic balances');
  a.E(`switchScreen('billing')`); a.E(`selectTable('t2')`); a.search('royal stag'); 
  const before = a.E(`qtyDisp(data.items.find(function(i){return i.id==='i_rs';}), data.items.find(function(i){return i.id==='i_rs';}).stockCounter)`);
  eq(before, '3', 'still 3 before the next sale');
  a.E(`addItemToCart(data.items.find(function(i){return i.id==='i_rs';}))`); a.$('btnSavePrintBill').click();
  eq(a.E(`qtyDisp(data.items.find(function(i){return i.id==='i_rs';}), data.items.find(function(i){return i.id==='i_rs';}).stockCounter)`), '2', 'selling a full bottle drops the shown stock by one');
  ok(a.E(`runMenuHealthCheck().filter(function(x){return /stock/i.test(x.text) && x.sev === 'error';}).length`) === 0, 'health check clean');
}
section('[X14] Bottle stock never shows a decimal');
{
  const a = await app();
  const f = v => a.E(`qtyDisp(data.items.find(function(i){return i.id==='i_rs';}), ${v})`);
  eq(f(2.4), '3', '2.4 shows as 3'); eq(f(10), '10', '10 stays 10'); eq(f(9.99999999), '10', 'float noise ignored'); eq(f(0.08), '1', 'last bottle still shows 1'); eq(f(0), '0', '0 shows 0');
}
section('[X15] Stock can never go negative');
{
  const mk = async (counter, godown) => { const a = await app(s => { const it = s.items.find(i=>i.id==='i_rs'); it.trackStock = true; it.stockCounter = counter; it.stockGodown = godown; s.bills = []; s.stockLog = []; }); a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); return a; };
  const item = `data.items.find(function(i){return i.id==='i_rs';})`;
  const add = a => a.E(`addItemToCart(${item})`);
  const lines = a => a.E(`(currentOrder()&&currentOrder().items||[]).reduce(function(s,c){return s+c.qty;},0)`);
  // 1. no stock at all
  let a = await mk(0, 0); add(a);
  eq(lines(a), 0, 'no stock: item is not added to the bill');
  ok(a.toasts.some(t => /No counter stock for Royal Stag/.test(t) && /opening stock/.test(t)), 'tells the user to add stock');
  // 2. stock only in godown
  a = await mk(0, 5); add(a);
  eq(lines(a), 0, 'godown only: blocked at the counter'); ok(a.toasts.some(t => /godown has 5 bottles, use Transfer/.test(t)), 'suggests Transfer');
  // 3. exactly 2 in counter: 2 ok, third blocked
  a = await mk(2, 0); add(a); add(a); add(a);
  eq(lines(a), 2, 'only as many as are in stock can be added'); ok(a.toasts.some(t => /only 2 bottles in counter stock/.test(t)), 'says how many are left');
  a.$('btnSavePrintBill').click();
  eq(a.E(`${item}.stockCounter`), 0, 'after selling the last bottles stock is exactly 0, not negative'); eq(a.E(`data.bills.length`), 1, 'bill saved');
  // 4. pegs from a partly used bottle
  a = await mk(0.1, 0);
  a.E(`addPegToCart(${item}, 60, 200)`); eq(lines(a), 1, '60 ml peg allowed with 75 ml left (0.1 bottle)');
  a.E(`addPegToCart(${item}, 60, 200)`); eq(lines(a), 1, 'second 60 ml peg blocked (only 15 ml left)');
  ok(a.toasts.some(t => /75 ml in counter stock|only 75 ml/.test(t)), 'message shows the ml left');
  // 5. + button and save-time guard (stock reduced after items were added)
  a = await mk(3, 0); add(a); add(a); a.E(`${item}.stockCounter = 1`);
  a.$('btnSavePrintBill').click();
  eq(a.E(`data.bills.length`), 0, 'save blocked when stock fell below the bill'); ok(a.toasts.some(t => /Cannot bill/.test(t)), 'user told');
  eq(a.E(`${item}.stockCounter`), 1, 'stock untouched by the blocked bill');
  // 6. untracked items never blocked
  a = await mk(0, 0); a.E(`${item}.trackStock = false`); add(a); eq(lines(a), 1, 'untracked item sells freely');
  // 7. editing a bill: its own stock is available again
  a = await mk(2, 0); add(a); add(a); a.$('btnSavePrintBill').click();
  const billId = a.E(`data.bills[0].id`);
  eq(a.E(`${item}.stockCounter`), 0, 'sold both');
  a.E(`switchScreen('history')`);
  const edit = a.$('historyList').querySelector('[data-edit="' + billId + '"]'); ok(!!edit, 'edit button present'); if(edit) edit.click();
  a.$('btnSaveBillEdit').click();
  ok(a.E(`data.bills[0].items[0].qty`) === 2 && a.E(`${item}.stockCounter`) === 0, 'saving an unchanged edit does not trip the stock check');
  // 8. menu tile tag
  a = await mk(0, 0); a.E(`renderPosSearchResults()`); a.$('posItemSearch').value = 'royal'; a.$('posItemSearch').dispatchEvent({type:'input', bubbles:true});
  ok(/out-tag/.test(a.$('posSearchResults').innerHTML), 'menu tile shows an OUT tag');
}
section('[X16] Opened bottles with exact ml left');
{
  const mk = async () => { const a = await app(s => { const it = s.items.find(i=>i.id==='i_rs'); it.stockCounter = 0; it.stockGodown = 0; s.stockLog = []; s.openingStockEntries = []; s.bills = []; }); a.E(`switchScreen('stock')`); return a; };
  const stock = a => a.E(`data.items.find(function(i){return i.id==='i_rs';}).stockCounter`);
  const run = (a, sealed, opened, ml) => { a.$('openingStockItemSelect').value = 'i_rs'; a.$('openingStockLocation').value = 'counter'; a.$('openingStockQty').value = sealed; a.$('openingStockLooseCount').value = opened; a.$('openingStockLooseMl').value = ml; a.$('openingStockDate').value = a.E(`localDateKey(businessNow())`); a.$('btnAddOpeningStock').click(); };
  let a = await mk(); run(a, '2', '1', '300');
  near(stock(a), 2 + 300 / 750, '2 sealed + 1 opened with 300 ml left = 2.4 bottles');
  eq(a.E(`qtyDisp(data.items.find(function(i){return i.id==='i_rs';}), ${stock(a)})`), '3', 'screen shows 3 bottles');
  a = await mk(); run(a, '0', '2', '500'); near(stock(a), 500 / 750, '2 opened bottles, 500 ml total left');
  a = await mk(); run(a, '1', '1', ''); eq(stock(a), 2, 'no ml given: opened bottle counted as full');
  a = await mk(); run(a, '1', '1', '900'); eq(stock(a), 0, 'more ml than one bottle holds is rejected'); ok(a.toasts.some(t => /can hold at most 750 ml/.test(t)), 'user told why');
  // selling is limited by the real ml
  a = await mk(); run(a, '0', '1', '100');
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`);
  a.E(`addPegToCart(data.items.find(function(i){return i.id==='i_rs';}), 60, 200)`);
  a.E(`addPegToCart(data.items.find(function(i){return i.id==='i_rs';}), 60, 200)`);
  eq(a.E(`currentOrder().items[0].qty`), 1, 'only one 60 ml peg can be sold from a bottle with 100 ml left');
}
section('[X17] Mobile numbers on the printed bill');
{
  const a = await app(s => { s.business.phone = '9876543210'; });
  a.E(`switchScreen('billing')`); a.E(`selectTable('t1')`); a.search('cola');
  a.$('posCustomerName').value = 'Ravi'; a.$('posCustomerName').dispatchEvent({type:'input', bubbles:true});
  a.$('posCustomerPhone').value = '9123456780'; a.$('posCustomerPhone').dispatchEvent({type:'input', bubbles:true});
  a.$('btnSavePrintBill').click();
  const r = a.$('receiptContent').innerHTML;
  ok(/Ph: 9876543210/.test(r), 'business mobile shown under the address');
  ok(/Mobile: 9123456780/.test(r), 'customer mobile shown');
  const b = await app(s => { s.business.phone = ''; }); b.E(`switchScreen('billing')`); b.E(`selectTable('t1')`); b.search('cola'); b.$('btnSavePrintBill').click();
  ok(!/Ph:|Mobile:/.test(b.$('receiptContent').innerHTML), 'no empty Ph/Mobile lines when none is set');
}
section('[X4] No text below 12px in the stylesheet');
{
  const fs = await import('node:fs'); const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  ok(!/font-size:\s*(?:[0-9]|1[01])px/.test(html), 'minimum font size is 12px');
}
done();
