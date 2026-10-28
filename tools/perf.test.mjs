// Performance / scale check: 2 years of a busy bar.
import {app, baseSeed, ok, section, done} from './flows.mjs';
const N_BILLS = +(process.env.PERF_BILLS || 15000), N_ITEMS = 400;
section(`[F1] Screens stay fast with ${N_BILLS} bills and ${N_ITEMS} items`);
const a = await app(s => {
  for(let i=0;i<N_ITEMS;i++) s.items.push({id:'x'+i, name:'Item '+i, categoryId: i%3===0?'cat_liq':'cat_food', saleRate:50+i, trackStock: i%2===0, stockCounter:50, stockGodown:50, exciseTracked: i%3===0, liquorType:'Whisky (IMFL)', bottleSize:'750 ml', barcodeValue:String(2000+i), itemCode:'X'+i, costPrice:30});
  const now = Date.now();
  for(let b=0;b<N_BILLS;b++){ const d = new Date(now - (b%700)*86400000).toISOString(); const it = s.items[b % s.items.length];
    s.bills.push({id:'b'+b, billNo:'INV-'+b, date:d, tableId:'t1', tableLabel:'1', items:[{itemId:it.id, name:it.name, price:it.saleRate, qty:2, pegMl:null}], subtotal:it.saleRate*2, discount:0, serviceCharge:0, tax:0, total:it.saleRate*2, paymentMode: b%4?'Cash':'UPI', editLog:[]});
    if(b % 5 === 0) s.stockLog.push({id:'l'+b, itemId:it.id, itemName:it.name, location:'counter', type:'sale', qtyChange:-2, balanceAfter:48, refId:'b'+b, date:d}); }
});
const time = (label, fn, limit) => { const t = Date.now(); fn(); const ms = Date.now() - t; ok(ms < limit, label + ': ' + ms + ' ms (limit ' + limit + ')'); };
time('open dashboard', () => a.E(`switchScreen('dashboard')`), 1500);
time('open billing', () => a.E(`switchScreen('billing')`), 1500);
time('open bill history', () => a.E(`switchScreen('history')`), 3000);
time('open stock', () => a.E(`switchScreen('stock')`), 2000);
time('open setup (400 items)', () => a.E(`switchScreen('setup')`), 2500);
time('search an item at the till', () => { a.E(`selectTable('t1')`); a.$('posItemSearch').value = 'Item 3'; a.$('posItemSearch').dispatchEvent({type:'input', bubbles:true}); }, 800);
const today = new Date().toISOString().slice(0,10), month = today.slice(0,7), from = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
time('daily closing (1 month)', () => a.E(`buildDailyClosingHtml('${from}','${today}',null,0)`), 4000);
time('profit & loss (1 month)', () => a.E(`buildPnlHtml('${from}','${today}')`), 4000);
time('excise daily register', () => a.E(`buildExciseTableHtml('${today}','${today}',{})`), 6000);
time('GST split (1 month)', () => a.E(`gstSplitSummary('${from}','${today}')`), 3000);
time('save one bill', () => { a.E(`selectTable('t2')`); a.search('cola'); a.$('posPaymentMode').value='Cash'; a.$('btnSavePrintBill').click(); }, 800);
done();
