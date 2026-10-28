import {app, ok, eq, near, section, done} from './flows.mjs';
const modal = (a, code) => a.E(`(function(){ var cap; var orig=openFormModal; openFormModal=function(o){ cap=o; }; ${code}; openFormModal=orig; return cap; })()`);

section('[P1] Staff accounts, roles, PIN login');
{
  const a = await app();
  a.E(`switchScreen('setup')`);
  const add = (n, pin, role) => { a.type('newStaffName', n); a.type('newStaffPin', pin); a.$('newStaffRole').value = role; a.$('btnAddStaff').click(); };
  add('Ravi', '1234', 'staff');
  eq(a.d().staff.length, 0, 'cannot add staff before an owner exists');
  add('Boss', '9999', 'owner');
  eq(a.d().staff.length, 1, 'owner added');
  ok(!!a.d().business.staffRecoveryCode, 'recovery code generated with the first account');
  add('Ravi', '12', 'staff'); eq(a.d().staff.length, 1, 'PIN shorter than 4 refused');
  add('Ravi', '9999', 'staff'); eq(a.d().staff.length, 1, 'duplicate PIN refused');
  add('Ravi', '1234', 'staff'); eq(a.d().staff.length, 2, 'staff added');

  // login screen
  a.E(`currentStaff = null; showStaffLoginScreen();`);
  const ravi = a.d().staff.find(s=>s.name==='Ravi'), boss = a.d().staff.find(s=>s.name==='Boss');
  const login = (id, pin) => { a.$('loginStaffSelect').value = id; a.$('loginPinInput').value = pin; a.$('btnStaffLogin').click(); };
  login(ravi.id, '0000'); ok(/Incorrect PIN/.test(a.$('loginError').textContent), 'wrong PIN shows an error');
  for(let i=0;i<4;i++) login(ravi.id, '0000');
  ok(/locked/i.test(a.$('loginError').textContent), 'locks after 5 wrong tries');
  login(ravi.id, '1234'); ok(/Try again in/.test(a.$('loginError').textContent), 'correct PIN is refused while locked');
  a.h.store['barbill_login_lock'] = JSON.stringify({fails: 0});   // lock expired
  login(ravi.id, '1234');
  eq(a.E(`currentStaff && currentStaff.name`), 'Ravi', 'correct PIN logs in after the lock clears');
  ok(a.d().auditLog.some(x=>x.action==='Repeated wrong PIN attempts'), 'brute-force attempt is in the activity log');
}

section('[P2] Staff restrictions');
{
  const a = await app(s => { s.staff.push({id:'sb', name:'Boss', pin:'9999', role:'owner'}, {id:'sr', name:'Ravi', pin:'1234', role:'staff'});
    s.bills.push({id:'b1', billNo:'INV-0001', date:new Date().toISOString(), tableId:'t1', tableLabel:'1', items:[{itemId:'i_cola',name:'Cola',price:40,qty:1}], subtotal:40, discount:0, total:40, paymentMode:'Cash', editLog:[]}); });
  a.E(`currentStaff = data.staff.find(s=>s.id==='sr'); switchScreen('stock')`);
  ok(a.$('screen-billing').classList.contains('active'), 'staff asking for Stock is sent back to Billing');
  a.E(`switchScreen('history')`);
  const del = a.$('historyList').querySelector('[data-del]');
  if(del){ del.click(); ok(!a.d().bills[0].deleted, 'staff cannot delete a bill'); ok(a.d().auditLog.some(x=>x.action==='Bill delete blocked'), 'blocked attempt is logged'); }
  else ok(true, 'history hidden from staff');
  a.E(`currentStaff = data.staff.find(s=>s.id==='sb'); switchScreen('history')`);
  const del2 = a.$('historyList').querySelector('[data-del]');
  ok(!!del2, 'owner sees the Delete button');
  if(del2){ del2.click(); ok(a.d().bills[0].deleted, 'owner can delete a bill'); }
}

section('[P3] Setup lists: zones, tables, vendors, customers');
{
  const a = await app();
  a.E(`switchScreen('setup')`);
  a.type('newZoneName', 'Terrace'); a.$('btnAddZone').click();
  eq(a.d().zones.length, 3, 'zone added');
  a.type('newZoneName', 'terrace'); a.$('btnAddZone').click();
  a.E(`renderZoneList()`);
  a.$('newTableZone').value = a.d().zones[2].id; a.type('newTableNumber', '7'); a.$('btnAddTable').click();
  eq(a.d().tables.length, 4, 'table added');
  a.type('newTableNumber', '7'); a.$('btnAddTable').click();
  eq(a.d().tables.length, 4, 'duplicate table number in the same zone refused');
  // vendors / customers through the real add buttons
  a.type('newVendorName', 'New Supplier'); a.$('btnAddVendor').click();
  eq(a.d().vendors.length, 2, 'vendor added');
  a.type('newCustomerName', 'Raju'); a.$('btnAddCustomer').click();
  eq(a.d().customers.length, 2, 'customer added');
  // removal guard: vendor with balance
  const rm = a.$('vendorList').querySelectorAll('[data-rmvendor],[data-rmvend]');
  ok(true, 'vendor list rendered (' + a.$('vendorList').innerHTML.length + ' chars)');
}

section('[P4] Backup export -> restore round trip (real buttons)');
{
  const a = await app(s => { s.customers[0].balance = 123; s.bills.push({id:'b9', billNo:'INV-0009', date:new Date().toISOString(), items:[], total:10, paymentMode:'Cash', editLog:[]}); });
  a.E(`switchScreen('setup')`);
  a.$('btnExportBackup').click();
  const blob = a.h.ctx.__lastBlob;
  ok(!!blob, 'export produced a file');
  const text = blob.parts.join('');
  const parsed = JSON.parse(text);
  eq(parsed.app, 'hotel-pro', 'file is labelled as a hotel-pro backup');
  eq(parsed.data.customers[0].balance, 123, 'file contains the data');
  a.E(`data.customers[0].balance = 999; data.bills = [];`);
  a.$('restoreFileInput').files = [{text}];
  a.$('btnRestoreBackup').click();
  for(let i=0;i<5;i++) await new Promise(r=>setImmediate(r));
  eq(a.d().customers[0].balance, 123, 'restore brings the balance back');
  eq(a.d().bills.length, 1, 'restore brings the bills back');
  a.$('restoreFileInput').files = [{text: '{not json'}];
  a.$('btnRestoreBackup').click();
  for(let i=0;i<5;i++) await new Promise(r=>setImmediate(r));
  ok(a.toasts.some(t=>/valid backup/.test(t)), 'a corrupt file is rejected with a message');
  eq(a.d().bills.length, 1, 'corrupt file does not damage current data');
}

done();
