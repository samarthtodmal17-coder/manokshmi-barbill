/* Manokshmi BarBill - desktop (Tauri) integration layer.
 * Loaded at the end of <body>. Provides: print window shim, external links,
 * file exports to Documents, licence gate, daily + on-close backups, safe
 * close and automatic updates. Everything except the print/link helpers is
 * inert in a plain browser tab.
 */
(function(){
  'use strict';

  var IS_TAURI = !!(window.__TAURI__ && window.__TAURI__.core);
  window.IS_TAURI = IS_TAURI;

  var APP_VERSION = '0.1.8';
  var PRODUCT_ID = 'bar-pos';
  var LICENSE_API_BASE = 'https://licensing-platform.pages.dev';
  var LICENSE_STORAGE_KEY = 'barBillLicense_v1';
  var DEVICE_ID_STORAGE_KEY = 'barBillDeviceId_v1';
  var LICENSE_RECHECK_DAYS = 14;
  var BACKUP_FOLDER = 'Manokshmi BarBill Backups';
  var EXPORT_FOLDER = 'Manokshmi BarBill Exports';
  var BACKUP_KEEP = 14;
  window.BARBILL_VERSION = APP_VERSION;

  function msg(text){ try{ if(typeof window.__barbillToast === 'function') window.__barbillToast(text); else console.log(text); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function errText(e){ return (e && e.message) || (typeof e === 'string' ? e : JSON.stringify(e)); }

  function docsSub(name){
    return window.__TAURI__.path.documentDir().then(function(d){ return window.__TAURI__.path.join(d, name); });
  }
  function plog(text){
    console.log('[barbill]', text);
    if(!IS_TAURI) return;
    try{
      docsSub(BACKUP_FOLDER).then(function(fp){
        return window.__TAURI__.fs.mkdir(fp, {recursive:true}).then(function(){ return window.__TAURI__.path.join(fp, 'debug.log'); });
      }).then(function(file){
        return window.__TAURI__.fs.writeTextFile(file, '[' + new Date().toISOString() + '] ' + text + '\n', {append:true});
      }).catch(function(){});
    }catch(e){}
  }

  /* ---------- printing: window.open() is blocked inside Tauri ---------- */
  window.openPrintWindow = function(features){
    if(!IS_TAURI) return window.open('', '_blank', features);
    var buf = '', frame = null, loaded = null;
    function render(){
      var old = document.getElementById('__printFrame');
      if(old) old.remove();
      frame = document.createElement('iframe');
      frame.id = '__printFrame';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      loaded = new Promise(function(res){ frame.onload = function(){ setTimeout(res, 250); }; });
      frame.srcdoc = buf;
      document.body.appendChild(frame);
    }
    return {
      document: { open: function(){ buf = ''; }, write: function(s){ buf += s; }, close: function(){ render(); } },
      focus: function(){},
      close: function(){},
      print: function(){
        if(!frame) render();
        loaded.then(function(){
          try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
          catch(e){ plog('print failed: ' + errText(e)); msg('Could not open the print dialog'); }
        });
      }
    };
  };

  /* ---------- external links (WhatsApp / mailto) ---------- */
  window.openExternal = function(url){
    if(!IS_TAURI){ window.open(url, '_blank'); return null; }
    window.__TAURI__.core.invoke('open_external', {url: url}).catch(function(e){
      plog('open_external failed: ' + errText(e));
      msg(/^sms:/i.test(url) ? 'SMS is not available on the desktop app. Use WhatsApp or copy the bill text.' : 'Could not open the link');
    });
    return null;
  };

  if(!IS_TAURI) return; // everything below is desktop-only

  /* ---------- plain <a target="_blank"> links (e.g. the excise portal) open in the default browser ---------- */
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a || a.hasAttribute('download')) return;
    var href = a.getAttribute('href') || '';
    if(/^(https?:|mailto:)/i.test(href)){
      e.preventDefault();
      window.openExternal(href);
    }
  }, true);

  /* ---------- file exports: save downloads into Documents\Manokshmi BarBill Exports ----------
     WebView downloads are unreliable, so every "a.download" blob (CSV / JSON exports) is written
     straight to a known folder and the owner is told exactly where. */
  var blobStore = {};
  if(typeof URL.createObjectURL === 'function'){
    var _create = URL.createObjectURL.bind(URL), _revoke = (URL.revokeObjectURL || function(){}).bind(URL);
    URL.createObjectURL = function(obj){ var u = _create(obj); if(obj instanceof Blob) blobStore[u] = obj; return u; };
    URL.revokeObjectURL = function(u){ setTimeout(function(){ delete blobStore[u]; }, 15000); _revoke(u); };
  }

  function safeFileName(n){
    n = String(n || 'export').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(0, 120);
    return n || 'export';
  }
  async function saveExport(blob, name){
    var fs = window.__TAURI__.fs, path = window.__TAURI__.path;
    var dir = await docsSub(EXPORT_FOLDER);
    await fs.mkdir(dir, {recursive:true});
    name = safeFileName(name);
    var full = await path.join(dir, name);
    if(await fs.exists(full)){
      var dot = name.lastIndexOf('.');
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      name = (dot > 0 ? name.slice(0, dot) + '-' + stamp + name.slice(dot) : name + '-' + stamp);
      full = await path.join(dir, name);
    }
    await fs.writeFile(full, new Uint8Array(await blob.arrayBuffer())); // binary-safe (xlsx) as well as text
    return full;
  }
  var _click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    var a = this;
    if(a.hasAttribute('download') && /^blob:/.test(a.href) && blobStore[a.href]){
      var blob = blobStore[a.href], name = a.getAttribute('download');
      saveExport(blob, name).then(function(full){
        msg('Saved to ' + full);
        plog('export saved: ' + full);
      }).catch(function(e){
        plog('export FAILED: ' + errText(e));
        msg('Could not save the file: ' + errText(e));
      });
      return;
    }
    return _click.apply(a, arguments);
  };

  /* ---------- licence ---------- */
  function getDeviceId(){
    function fallback(){
      var id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if(!id){ id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(); localStorage.setItem(DEVICE_ID_STORAGE_KEY, id); }
      return id;
    }
    return window.__TAURI__.core.invoke('get_device_fingerprint').then(function(id){ return id || fallback(); }).catch(function(){ return fallback(); });
  }
  function getLicense(){ try{ var r = localStorage.getItem(LICENSE_STORAGE_KEY); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
  function setLicense(rec){ try{ localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(rec)); }catch(e){} }
  function callActivate(key, deviceId){
    return fetch(LICENSE_API_BASE + '/api/activate', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({licenseKey: key, deviceId: deviceId, productId: PRODUCT_ID, appVersion: APP_VERSION, dbVersion: 1})
    }).then(function(r){ return r.json(); });
  }

  var gateOpen = null;
  function showGate(initialError){
    if(gateOpen) return gateOpen;
    gateOpen = new Promise(function(resolve){
      var ov = document.createElement('div');
      ov.id = 'licenseGate';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#101a33;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;';
      ov.innerHTML =
        '<div style="background:#fff;border-radius:14px;padding:32px;width:380px;max-width:92vw;text-align:center;">' +
        '<h2 style="margin:0 0 4px;color:#101a33;">Manokshmi BarBill</h2>' +
        '<p style="margin:0 0 18px;color:#666;font-size:13px;">Enter your licence key to activate this computer.<br>Internet is needed only for this first step.</p>' +
        '<input id="lgKey" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px;font-size:15px;text-align:center;letter-spacing:1px;border:1px solid #ccc;border-radius:8px;">' +
        '<button id="lgGo" style="margin-top:12px;width:100%;padding:11px;font-size:15px;font-weight:700;border:0;border-radius:8px;background:#101a33;color:#fff;cursor:pointer;">Activate</button>' +
        '<div id="lgErr" style="margin-top:10px;color:#c0392b;font-size:13px;min-height:16px;"></div>' +
        '<div style="margin-top:14px;color:#999;font-size:11px;">Product of Manokshmi Technologies &middot; v' + APP_VERSION + '</div></div>';
      document.body.appendChild(ov);
      var key = ov.querySelector('#lgKey'), go = ov.querySelector('#lgGo'), err = ov.querySelector('#lgErr');
      if(initialError) err.textContent = initialError;
      key.focus();
      key.addEventListener('keydown', function(e){ if(e.key === 'Enter') go.click(); });
      go.addEventListener('click', function(){
        var entered = key.value.trim();
        if(!entered) return;
        err.textContent = ''; go.disabled = true; go.textContent = 'Checking...';
        var deviceId;
        getDeviceId().then(function(d){ deviceId = d; return callActivate(entered, d); }).then(function(res){
          go.disabled = false; go.textContent = 'Activate';
          if(res.ok){
            setLicense({ok:true, licenseKey:entered, deviceId:deviceId, customerName:res.customerName, tier:res.tier, activatedAt:res.activatedAt, lastCheckedAt:new Date().toISOString()});
            ov.remove(); gateOpen = null; resolve();
          } else err.textContent = res.error || 'Invalid licence key.';
        }).catch(function(){
          go.disabled = false; go.textContent = 'Activate';
          err.textContent = "Couldn't reach the activation server. Check the internet connection and try again.";
        });
      });
    });
    return gateOpen;
  }

  // Awaited by startApp() BEFORE any data is loaded: an unlicensed copy never reads the database.
  window.ensureLicensed = async function(){
    var rec = getLicense();
    if(!(rec && rec.ok && rec.licenseKey)) await showGate();
    maybeRecheck();
  };

  function maybeRecheck(){
    var rec = getLicense();
    if(!rec || !rec.ok || !navigator.onLine) return;
    var last = rec.lastCheckedAt ? new Date(rec.lastCheckedAt).getTime() : 0;
    if((Date.now() - last) / 86400000 < LICENSE_RECHECK_DAYS) return;
    callActivate(rec.licenseKey, rec.deviceId).then(function(res){
      if(res.ok){ rec.lastCheckedAt = new Date().toISOString(); rec.customerName = res.customerName; rec.tier = res.tier; setLicense(rec); }
      else if(res.revoked || res.expired || /wasn't found|different device/i.test(res.error || '')){
        // Revoked/expired: lock access only. Shop data is never touched.
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        showGate(res.error || 'This licence is no longer active. Please contact support.');
      }
    }).catch(function(){ /* offline or server hiccup: try again next time */ });
  }

  /* ---------- backups (Documents folder, independent of the AppData database) ---------- */
  var backupChain = Promise.resolve();
  function enqueueBackup(fn){
    var p = backupChain.catch(function(){}).then(fn);
    backupChain = p.catch(function(){});
    return p;
  }
  function backupName(){ return 'backup-' + new Date().toISOString().slice(0, 10) + '.json'; }

  async function writeBackup(onlyIfMissing){
    var fs = window.__TAURI__.fs, path = window.__TAURI__.path;
    if(typeof window.__barbillBackup !== 'function') throw new Error('app not ready');
    var fp = await docsSub(BACKUP_FOLDER);
    await fs.mkdir(fp, {recursive:true});
    var file = await path.join(fp, backupName());
    if(onlyIfMissing && await fs.exists(file)) return;
    var payload = window.__barbillBackup();
    // Never overwrite a good backup with an empty one.
    if(!payload || !payload.data || !Array.isArray(payload.data.bills)) throw new Error('nothing to back up yet');
    var tmp = file + '.tmp';
    await fs.writeTextFile(tmp, JSON.stringify(payload));
    await fs.rename(tmp, file);
    var entries = await fs.readDir(fp);
    var names = entries.map(function(e){ return e.name; }).filter(function(n){ return n && /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(n); }).sort();
    var drop = names.slice(0, Math.max(0, names.length - BACKUP_KEEP));
    for(var i = 0; i < drop.length; i++){
      try{ await fs.remove(await path.join(fp, drop[i])); }catch(e){ /* already gone */ }
    }
  }

  // Called once the data is loaded. Never blocks billing.
  window.barbillStartDesktopServices = function(){
    if(window.__barbillServicesStarted) return;
    window.__barbillServicesStarted = true;
    window.__barbillAppStarted = true;
    enqueueBackup(function(){ return writeBackup(true); }).catch(function(e){
      plog('startup backup FAILED: ' + errText(e));
      msg("Today's automatic backup didn't complete. Your data is fine, but please export a manual backup from Setup.");
    });
    // The licence and the daily backup are re-checked each day the app stays open overnight.
    setInterval(function(){ enqueueBackup(function(){ return writeBackup(true); }).catch(function(){}); maybeRecheck(); }, 6 * 3600 * 1000);
    setTimeout(checkForUpdate, 5000);
  };

  /* ---------- safe close: finish saves -> backup -> close DB -> exit ---------- */
  var closing = false;
  function idle(){ return window.BarbillDB ? window.BarbillDB.idle() : Promise.resolve(); }
  // Hard exit: the Rust command always works (no plugin permission needed).
  function hardExit(){
    try{ window.__TAURI__.core.invoke('force_exit'); }catch(e){}
    try{ window.__TAURI__.process.exit(0); }catch(e){}
  }
  function showClosingOverlay(){
    try{
      var o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(16,26,51,.85);color:#fff;display:flex;align-items:center;justify-content:center;font:700 18px Arial,sans-serif;';
      o.textContent = 'Saving and closing...';
      document.body.appendChild(o);
    }catch(e){}
  }
  window.__TAURI__.window.getCurrentWindow().onCloseRequested(function(event){
    event.preventDefault();                      // we always handle the close ourselves
    if(closing) return;
    closing = true;
    plog('close-requested (started=' + !!window.__barbillAppStarted + ')');
    if(!window.__barbillAppStarted){ hardExit(); return; }   // licence screen: nothing to save
    showClosingOverlay();
    // Watchdog: whatever is stuck, the app is gone after 7 seconds.
    setTimeout(function(){ plog('watchdog: forcing exit'); hardExit(); }, 7000);
    var work = Promise.race([
      idle().then(function(){ return enqueueBackup(function(){ return writeBackup(false); }); })
        .then(function(){ plog('end-of-day backup ok'); })
        .catch(function(e){ plog('end-of-day backup FAILED: ' + errText(e)); }),
      sleep(4000).then(function(){ plog('save/backup timed out at 4s'); })
    ]);
    work.then(function(){
      return Promise.race([
        (window.BarbillDB ? window.BarbillDB.flushAndClose() : Promise.resolve()).then(function(){ plog('db closed'); }).catch(function(e){ plog('db close FAILED: ' + errText(e)); }),
        sleep(2000)
      ]);
    }).then(function(){
      plog('exiting');
      hardExit();
    }).catch(function(e){
      plog('close sequence error: ' + errText(e));
      hardExit();
    });
  }).catch(function(e){ console.error('could not register close handler', e); });

  /* ---------- automatic updates ---------- */
  function checkForUpdate(){
    if(!(window.__TAURI__.updater && window.__TAURI__.process)){ plog('Update check skipped: updater plugin missing'); return; }
    plog('Update check: installed ' + APP_VERSION);
    window.__TAURI__.updater.check().then(function(update){
      if(!update){ plog('Update check: up to date'); return; }
      plog('Update available: ' + update.version);
      var yes = confirm('A new version (' + update.version + ') is available. Install now? The app will restart.');
      if(!yes){ msg('Update postponed.'); return; }
      msg('Downloading update ' + update.version + '...');
      return update.downloadAndInstall().then(function(){ plog('Update installed'); msg('Update installed. Restarting...'); return window.__TAURI__.process.relaunch(); });
    }).catch(function(e){ plog('Update check FAILED: ' + e); console.error('Update check failed', e); });
  }
})();
