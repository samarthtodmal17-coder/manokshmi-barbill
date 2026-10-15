// Run: node tools/test-adapter.mjs   (Node 22+, built-in node:sqlite)
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const A = require('../www/sqlite-adapter.js');

const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync(new URL('../src-tauri/migrations/0001_init.sql', import.meta.url), 'utf8'));
let busyOnce = 0, failNext = false, writes = 0;
const driver = {
  async execute(sql, params){
    if(busyOnce > 0){ busyOnce--; throw new Error('database is locked'); }
    if(failNext){ failNext = false; throw new Error('disk I/O error'); }
    if(/^INSERT/.test(sql)) writes++;
    const r = raw.prepare(sql.replace(/\$(\d+)/g, '?$1')).run(...params);
    return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
  },
  async select(sql, params){ return raw.prepare(sql.replace(/\$(\d+)/g, '?$1')).all(...params).map(r => ({...r})); },
  async close(){ raw.close(); }
};
const db = A.create(driver, {coalesceMs: 10});
await db.init();

// empty db
assert.deepEqual(await db.getAll(), []);
// multi-key save lands atomically and round-trips objects/arrays
const bills = [{id:'b1', total:100, items:[{n:'Peg', q:2}]}];
await db.putAll([{key:'bills', value:bills}, {key:'business', value:{name:'Test Bar'}}, {key:'items', value:[]}]);
let all = await db.getAll();
assert.equal(all.length, 3);
assert.deepEqual(all.find(r => r.key === 'bills').value, bills);
// update replaces (no duplicates)
await db.putAll([{key:'bills', value:[{id:'b2'}]}]);
all = await db.getAll();
assert.equal(all.length, 3);
assert.deepEqual(all.find(r => r.key === 'bills').value, [{id:'b2'}]);
// undefined slice is skipped, not stored as "undefined"
await db.putAll([{key:'ghost', value:undefined}]);
assert.equal((await db.getAll()).length, 3);
// coalescing: 50 rapid saves of the same key -> far fewer writes, latest value wins, all promises resolve
const before = writes;
const live = {n:0};
const ps = [];
for(let i = 1; i <= 50; i++){ live.n = i; ps.push(db.putAll([{key:'bills', value:live}])); }
await Promise.all(ps);
assert.ok(writes - before <= 2, 'coalesced writes: ' + (writes - before));
assert.equal((await db.getAll()).find(r => r.key === 'bills').value.n, 50);
// value mutated AFTER save call but before flush is still stored (latest in-memory state)
const obj = {v:1}; const p = db.putAll([{key:'x', value:obj}]); obj.v = 2; await p;
assert.equal((await db.getAll()).find(r => r.key === 'x').value.v, 2);
// busy retry
busyOnce = 2;
await db.putAll([{key:'items', value:[1]}]);
assert.deepEqual((await db.getAll()).find(r => r.key === 'items').value, [1]);
// hard failure rejects the callers, and does not poison later saves
failNext = true;
await assert.rejects(db.putAll([{key:'items', value:[2]}]));
await db.putAll([{key:'items', value:[3]}]);
assert.deepEqual((await db.getAll()).find(r => r.key === 'items').value, [3]);
// big value (5 MB) round-trips
const big = Array.from({length: 50000}, (_, i) => ({id:'bill_' + i, note:'x'.repeat(80)}));
await db.putAll([{key:'bills', value:big}]);
assert.equal((await db.getAll()).find(r => r.key === 'bills').value.length, 50000);
// clearAll also drops anything still pending
const pc = db.putAll([{key:'bills', value:[1]}]).catch(()=>{});
await db.clearAll(); await pc;
assert.deepEqual(await db.getAll(), []);
// flushAndClose drains pending writes first
db.putAll([{key:'business', value:{name:'last'}}]);
const snapshotDb = raw; 
await db.flushAndClose();
await assert.rejects(db.getAll());
await assert.rejects(db.putAll([{key:'a', value:1}]));
console.log('ALL BARBILL ADAPTER TESTS PASSED');
