import {app, ok, eq, near, section, done} from './flows.mjs';

section('[E1] Keyboard chooser: ambiguous search → pick with keys');
{
  const a = await app();
  a.E(`switchScreen('billing'); selectTable('t1')`);
  a.search('c');                     // matches Chicken Fry and Cola
  ok(a.E(`kbdChooseOpen`), 'chooser opens when several items match');
  a.h.document.dispatchEvent({type:'keydown', key:'ArrowDown', preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}});
  a.h.document.dispatchEvent({type:'keydown', key:'Enter', preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}});
  ok(!a.E(`kbdChooseOpen`), 'chooser closes after Enter');
  eq(a.d().openOrders[0].items.length, 1, 'one item was added');
  a.search('royal');
  ok(a.E(`kbdChooseOpen`), 'a liquor item asks which pour (bottle / pegs)');
  a.h.document.dispatchEvent({type:'keydown', key:'2', preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}});
  ok(a.d().openOrders[0].items.some(c=>c.itemId==='i_rs' && c.pegMl === 30), 'pressing 2 picks the 30 ml peg');
}

section('[E2] Add a liquor brand with several sizes in one go');
{
  const a = await app();
  a.E(`switchScreen('setup'); menuMode='liquor'; applyMenuMode(); renderItemSelects(); resetSizeRows();`);
  a.$('newItemCategory').value = 'cat_liq';
  a.type('newItemName', 'Blenders Pride');
  const lt = a.$('newItemLiquorType'); if(lt.options.length > 1) lt.value = lt.options[1].value;
  const rows = a.$('newItemSizeRows').querySelectorAll('.size-row');
  ok(rows.length >= 1, 'size rows are present (' + rows.length + ')');
  rows[0].querySelector('.sz-size').value = '750 ml'; rows[0].querySelector('.sz-rate').value = '2400'; rows[0].querySelector('.sz-cost').value = '1800';
  a.$('btnAddSizeRow').click();
  const rows2 = a.$('newItemSizeRows').querySelectorAll('.size-row');
  rows2[1].querySelector('.sz-size').value = '180'; rows2[1].querySelector('.sz-rate').value = '650';
  a.$('newItemTrackStock').checked = true;
  a.$('btnAddItem').click();
  const made = a.d().items.filter(i => /Blenders Pride/.test(i.name));
  eq(made.length, 2, 'two items created (one per size): ' + made.map(i=>i.name).join(' | '));
  if(made.length === 2){
    eq(made.map(i=>i.saleRate).sort((x,y)=>x-y), [650, 2400], 'rates saved per size');
    ok(made.every(i => i.exciseTracked && i.trackStock && i.liquorType), 'both are excise + tracked with a liquor type');
    ok(new Set(made.map(i=>i.barcodeValue)).size === 2, 'each size has its own barcode');
  }
  // duplicate
  a.type('newItemName', 'Blenders Pride');
  a.E(`resetSizeRows()`);
  const r3 = a.$('newItemSizeRows').querySelectorAll('.size-row')[0]; r3.querySelector('.sz-size').value = '750 ml'; r3.querySelector('.sz-rate').value = '2500';
  a.$('btnAddItem').click();
  eq(a.d().items.filter(i => /Blenders Pride/.test(i.name)).length, 2, 'adding the same brand+size again is refused');
}

section('[E3] Category add / remove rules');
{
  const a = await app();
  a.E(`switchScreen('setup'); menuMode='food'; applyMenuMode();`);
  a.type('newCategoryName', 'Starters'); a.$('btnAddCategory').click();
  ok(a.d().categories.some(c => c.name === 'Starters'), 'category added');
  const cat = a.d().categories.find(c => c.name === 'Starters');
  ok(cat && cat.isExciseCategory === false || cat.isExciseCategory === undefined, 'new food category is not an excise category');
  a.E(`renderCategoryList()`);
  const rm = a.$('categoryListFood').querySelector('[data-rmcat="' + cat.id + '"]');
  ok(!!rm, 'remove button present');
  if(rm){ rm.click(); ok(!a.d().categories.some(c => c.id === cat.id), 'empty category removed'); }
  const rmFood = a.$('categoryListFood').querySelector('[data-rmcat="cat_food"]');
  if(rmFood){ rmFood.click(); ok(a.d().categories.some(c => c.id === 'cat_food'), 'category that still has items cannot be removed'); }
}

section('[E4] Item list buttons: favourite, rate, remove');
{
  const a = await app();
  a.E(`switchScreen('setup'); menuMode='food'; applyMenuMode(); renderItemList();`);
  const fav = a.$('itemListFood').querySelector('[data-togglefav="i_cola"]');
  ok(!!fav, 'favourite star present'); if(fav){ fav.click(); ok(a.d().items.find(i=>i.id==='i_cola').isFavorite, 'star toggles favourite'); }
  const rate = a.$('itemListFood').querySelector('[data-fe="rate"][data-id="i_ch"]');
  ok(!!rate, 'rate box present in the food list');
  if(rate){ rate.value = '300'; rate.dispatchEvent({type:'change', bubbles:true}); eq(a.d().items.find(i=>i.id==='i_ch').saleRate, 300, 'typing a rate saves it'); }
  const rm = a.$('itemListFood').querySelector('[data-rmitem="i_ch"]');
  if(rm){ rm.click(); ok(!a.d().items.some(i=>i.id==='i_ch'), 'unused item can be removed'); }
}

done();
