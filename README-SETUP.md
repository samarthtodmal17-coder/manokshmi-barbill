# Manokshmi BarBill (Tauri desktop, SQLite)

Bar billing and management (from hotel-pro.html) as a licensed Windows desktop app. Version 0.1.0.

## Files
- `www/index.html` - the bar app (UI/features unchanged) plus: SQLite dispatch, licence gate before any data is read, print/link/export shims, login lockout, owner-only bill delete, clock-change audit flag, offline copies of the Excel and QR libraries (`www/vendor/`).
- `www/sqlite-adapter.js` - storage: one table `kv(key,value)`, one JSON value per collection; single write queue, coalesced saves, atomic multi-key writes, busy-retry.
- `www/tauri-integration.js` - licence (product id `bar-pos`), daily + on-close backups, safe close, signed updates, CSV/XLSX/JSON exports saved to Documents.
- `src-tauri/` - Rust shell (`get_device_fingerprint`, `open_external`), migration `0001_init.sql`.
- `tools/test-adapter.mjs` - `node tools/test-adapter.mjs` (Node 22+).

## One-time setup
1. New GitHub repo `manokshmi-barbill` (empty, no README).
2. Repo Settings > Secrets and variables > Actions: add `TAURI_SIGNING_PRIVATE_KEY` (the WHOLE key file, no trailing blank line) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (same values as RestroBill; the public key in tauri.conf.json is the same).
3. Licensing admin (https://licensing-platform.pages.dev/admin.html) > Products: register id `bar-pos`, name "Manokshmi BarBill"; issue a test key.
4. Push: git init, git add ., git commit -m "BarBill 0.1.0", git branch -M main, git remote add origin https://github.com/samarthtodmal17-coder/manokshmi-barbill.git, git push -u origin main, git tag v0.1.0, git push origin v0.1.0. Publish the draft release when the build is green.

## Moving a bar's existing data in
Old file: Setup > Data > Export Backup. BarBill: Setup > Restore Backup. (Browser data cannot be read by the desktop app.)

## Where things live
- Database: `%APPDATA%\in.manokshmitechnologies.barbill\barbill.db`
- Backups + debug.log: `Documents\Manokshmi BarBill Backups\` (daily, 14 kept, refreshed on close)
- CSV/XLSX/JSON exports: `Documents\Manokshmi BarBill Exports\`

## Releasing updates
Bump version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `APP_VERSION` in `www/tauri-integration.js`; commit; tag vX.Y.Z; push the tag. Never edit `0001_init.sql` after release.

## Not verified here
Rust was not compiled in the build sandbox (first GitHub run is the compile check). Test on Windows: licence activation, printing (bill, KOT, barcode labels), WhatsApp link, exports, close + reopen keeps data, restore from an old-file backup.
