import {app, ok, eq, section, done} from './flows.mjs';
import fs from 'fs'; import vm from 'vm';

async function withMarathi(mod){
  const a = await app(mod);
  vm.runInContext(fs.readFileSync(new URL('../www/marathi.js', import.meta.url), 'utf8'), a.h.ctx);
  return a;
}
const devanagari = t => (t.match(/[ऀ-ॿ]/g) || []).length;
const latinWords = t => (t.match(/[A-Za-z]{4,}/g) || []);

section('[L1] Every screen converts to Marathi and back losslessly');
{
  const a = await withMarathi(s => { s.vendors[0].name = 'Sharma Traders'; });
  const UI = a.h.ctx.MarathiUI;
  ok(UI && UI.dictSize > 1000, 'dictionary loaded (' + (UI && UI.dictSize) + ' entries)');
  for(const name of ['dashboard','billing','history','stock','purchase','purchaseorders','expenses','reports','ledger','setup']){
    a.E(`switchScreen('${name}')`);
    const before = a.$('screen-' + name).textContent;
    UI.setLang('mr');
    const mr = a.$('screen-' + name).textContent;
    ok(devanagari(mr) > 20, name + ': Marathi text present (' + devanagari(mr) + ' Devanagari characters)');
    UI.setLang('en');
    eq(a.$('screen-' + name).textContent, before, name + ': switching back restores the exact English text');
  }
}

section('[L2] Nothing important is left in English on key screens');
{
  const a = await withMarathi();
  const UI = a.h.ctx.MarathiUI;
  UI.setLang('mr');
  for(const name of ['dashboard','billing','stock','expenses','ledger']){
    a.E(`switchScreen('${name}')`); UI.setLang('mr');
    const words = latinWords(a.$('screen-' + name).textContent).filter(w => !/^(Test|Royal|Stag|Cola|Chicken|Sharma|Traders|Amit|KOT|UPI|FLR|Esc|Enter|Ctrl|Alt|Hotel)$/i.test(w));
    ok(words.length === 0, name + ': no English words left' + (words.length ? ' -> ' + [...new Set(words)].slice(0,8).join(', ') : ''));
  }
}

section('[L3] The app keeps working while in Marathi');
{
  const a = await withMarathi();
  const UI = a.h.ctx.MarathiUI; UI.setLang('mr');
  a.E(`switchScreen('billing'); selectTable('t1')`); UI.setLang('mr');
  a.search('2*cola'); a.$('posPaymentMode').value = 'Cash'; a.$('btnSavePrintBill').click();
  eq(a.d().bills.length, 1, 'a bill can be saved with the screen in Marathi');
  eq(a.d().bills[0].items[0].name, 'Cola', 'saved bill keeps the real (English) item name in data');
  ok(!/[ऀ-ॿ]/.test(a.$('receiptContent').textContent), 'printed receipt is not translated');
  ok(devanagari(a.$('screen-billing').textContent) > 10, 'screen text is still Marathi');
}

section('[L4] Names typed in English show in Marathi');
{
  const a = await withMarathi();
  const T = a.h.ctx.MarathiUI.translate;
  ok(/[ऀ-ॿ]/.test(T('Royal Stag 750 ml')) && /750/.test(T('Royal Stag 750 ml')), 'brand name transliterated, size kept: ' + T('Royal Stag 750 ml'));
  eq(T('Bill No: INV-0012'), 'बिल क्र.: INV-0012', 'bill numbers stay as typed');
  ok(T('mail me at a@b.com').includes('a@b.com'), 'e-mail addresses are untouched');
  a.h.ctx.MarathiUI.setUserWords('Royal Stag = रॉयल स्टॅग\nBlenders Pride = ब्लेंडर्स प्राईड');
  eq(T('Royal Stag 750 ml'), 'रॉयल स्टॅग 750 मिली', 'owner-defined spelling overrides the automatic one');
}

done();
