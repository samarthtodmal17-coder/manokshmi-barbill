// UX layer: attention strip, setup guide, save indicator, text size, shortcuts, labels.
import {app, ok, eq, section, done} from './flows.mjs';
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
  // top sellers fill the grid when nothing is starred
  const c = await app(s => { s.items.forEach(i=>i.isFavorite=false); const it = s.items[0]; s.bills.push({id:'b1', billNo:'1', date:new Date().toISOString(), items:[{itemId:it.id, name:it.name, price:it.saleRate, qty:5}], total:it.saleRate*5, paymentMode:'Cash'}); });
  c.E(`switchScreen('billing')`); c.E(`renderBillingScreen()`);
  ok(c.$('posFavChips').querySelectorAll('.fav-btn').length === 1, 'top seller auto-appears with no stars');
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
section('[X4] No text below 12px in the stylesheet');
{
  const fs = await import('node:fs'); const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  ok(!/font-size:\s*(?:[0-9]|1[01])px/.test(html), 'minimum font size is 12px');
}
done();
