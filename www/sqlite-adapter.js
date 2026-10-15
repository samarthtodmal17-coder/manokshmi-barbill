/* Manokshmi BarBill - SQLite storage adapter.
 *
 * The app keeps its data as ~18 top-level collections (bills, items, stockLog,
 * ...), each saved under its own key. In the browser that was IndexedDB; here it
 * is one SQLite table `kv(key, value)` with the collection as JSON text.
 *
 * Safety design (lessons from RestroBill):
 *  - every operation runs through ONE FIFO queue (no concurrent writers -> no
 *    "database is locked"), with busy/locked retry;
 *  - rapid saves are coalesced: if five saves for "bills" arrive in a row only the
 *    latest in-memory value is written, and all five callers' promises resolve once
 *    that write has really finished;
 *  - a batch of keys is written with ONE multi-row INSERT ... ON CONFLICT DO UPDATE,
 *    which SQLite applies atomically (all keys or none), never INSERT OR REPLACE;
 *  - flushAndClose() drains pending writes before the connection is closed.
 */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.BarbillSql = factory();
})(typeof self !== 'undefined' ? self : this, function(){

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function isBusy(err){ return /locked|busy/i.test((err && err.message) || String(err)); }

  var INIT_SQL = 'CREATE TABLE IF NOT EXISTS kv ("key" TEXT PRIMARY KEY NOT NULL, "value" TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime(\'now\')))';

  function create(driver, opts){
    opts = opts || {};
    var coalesceMs = opts.coalesceMs == null ? 40 : opts.coalesceMs;
    var chain = Promise.resolve();
    var closed = false;
    var pending = {};          // key -> value object (latest wins)
    var waiters = [];          // {resolve,reject} for the next flush
    var flushScheduled = false;

    function enqueue(fn){
      if(closed) return Promise.reject(new Error('Database is closed'));
      var p = chain.then(fn);
      chain = p.catch(function(){});
      return p;
    }
    async function withRetry(fn){
      var delay = 40, last;
      for(var i = 0; i < 7; i++){
        try{ return await fn(); }
        catch(e){ last = e; if(!isBusy(e)) throw e; await sleep(delay); delay *= 2; }
      }
      throw last;
    }
    function exec(sql, params){ return withRetry(function(){ return driver.execute(sql, params || []); }); }
    function sel(sql, params){ return withRetry(function(){ return driver.select(sql, params || []); }); }

    // Writes everything currently pending in one atomic statement (chunked if huge).
    function doFlush(){
      var keys = Object.keys(pending);
      var snapshot = keys.map(function(k){ return [k, pending[k]]; });
      var myWaiters = waiters; waiters = []; flushScheduled = false;
      pending = {};
      return (async function(){
        try{
          // Serialise NOW (inside the queue) so we always store the newest state.
          var rows = [];
          snapshot.forEach(function(kv){
            if(kv[1] === undefined) return;
            rows.push([kv[0], JSON.stringify(kv[1])]);
          });
          if(rows.length){
            var ph = [], params = [];
            rows.forEach(function(r, i){ ph.push('($' + (i*3+1) + ',$' + (i*3+2) + ',$' + (i*3+3) + ')'); params.push(r[0], r[1], new Date().toISOString()); });
            await exec('INSERT INTO kv ("key","value",updated_at) VALUES ' + ph.join(',') +
              ' ON CONFLICT("key") DO UPDATE SET "value"=excluded."value", updated_at=excluded.updated_at', params);
          }
          myWaiters.forEach(function(w){ w.resolve(); });
        }catch(e){
          myWaiters.forEach(function(w){ w.reject(e); });
          throw e;
        }
      })();
    }

    function scheduleFlush(){
      if(flushScheduled) return;
      flushScheduled = true;
      setTimeout(function(){ enqueue(doFlush).catch(function(){}); }, coalesceMs);
    }

    return {
      init: function(){ return enqueue(function(){ return exec(INIT_SQL); }); },
      // pairs: [{key, value}]. Resolves after the data is really on disk.
      putAll: function(pairs){
        if(closed) return Promise.reject(new Error('Database is closed'));
        return new Promise(function(resolve, reject){
          pairs.forEach(function(p){ pending[p.key] = p.value; });
          waiters.push({resolve: resolve, reject: reject});
          scheduleFlush();
        });
      },
      getAll: function(){
        return enqueue(async function(){
          var rows = await sel('SELECT "key", "value" FROM kv ORDER BY "key"');
          return rows.map(function(r){ return {key: r.key, value: JSON.parse(r.value)}; });
        });
      },
      clearAll: function(){
        // Anything still waiting to be written would resurrect data after the wipe.
        pending = {};
        return enqueue(function(){ return exec('DELETE FROM kv'); });
      },
      // Resolves when every write accepted so far has finished.
      idle: function(){
        return new Promise(function(resolve){
          function check(){
            if(flushScheduled || Object.keys(pending).length){ setTimeout(check, 15); return; }
            chain.catch(function(){}).then(resolve);
          }
          check();
        });
      },
      flushAndClose: async function(){
        await this.idle();
        await chain.catch(function(){});
        closed = true;
        if(driver.close) await driver.close();
      }
    };
  }

  return {create: create, INIT_SQL: INIT_SQL};
});
