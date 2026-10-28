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
section('[X4] No text below 12px in the stylesheet');
{
  const fs = await import('node:fs'); const html = fs.readFileSync(new URL('../www/index.html', import.meta.url), 'utf8');
  ok(!/font-size:\s*(?:[0-9]|1[01])px/.test(html), 'minimum font size is 12px');
}
done();
