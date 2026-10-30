I'm Samarth (Manokshmi Technologies, Maharashtra; not a coder). We are building the licensed Windows desktop app "Manokshmi BarBill" (Tauri v2 + SQLite). Folder: C:\Desktop\BILLING SOFTWARE\Latest Version\Restaurant\manokshmi-barbill. Repo: samarthtodmal17-coder/manokshmi-barbill. Licensing: https://licensing-platform.pages.dev (product id bar-pos).

RULES
- Work on the DESKTOP APP ONLY (www/index.html, www/tauri-integration.js, www/marathi.js, www/sqlite-adapter.js, src-tauri). Do not touch hotel-pro.html, RestroBill or ClothBill.
- When I say "update": bump the version in all 4 places (package.json line 3, src-tauri/tauri.conf.json line 4, src-tauri/Cargo.toml line 3, APP_VERSION line 13 of www/tauri-integration.js), then give PowerShell commands: cd to folder; git add .; git commit -m "..."; git tag vX.Y.Z; git push origin main; git push origin vX.Y.Z; then publish the DRAFT release on GitHub (edit the draft, never "create new release"). Never reuse an existing tag number.
- Never ask me to paste secrets in chat. Keep answers short. Be honest about what is verified: the sandbox cannot run the real Windows app or Rust; tests run the real index.html in a fake DOM.
- Run `npm test` (tools/*.test.mjs, incl. fuzz, marathi, perf, ux) after every change; add tests for new work.

CURRENT STATE
- Latest code version: 0.1.11 (billing-screen compact favourites/categories, opening stock with Loose ml) - release it if not yet pushed. 0.1.9 contains the UX overhaul (v0.1.8 tag was previously used).
- Built this session: dashboard "Needs attention" strip + first-run checklist, saved indicator, A-/A+ text size, F1 shortcut sheet, sidebar groups, cash received/change due, favourites (starred items only, tiny chips), custom confirm dialog + Undo (10 s, refuses if other saves happened), table-seated timers, click-to-sort tables, date chips on report filters, Close-the-Day wizard, daily closing drawer fix, opening stock with loose ml (stock stored as fractional bottles).
- UX roadmap: UX-REVIEW-AND-ROADMAP.md.

NEXT (sell-readiness)
1. Pilot with 3-5 real bars on the real Windows app (printer, scanner).
2. Buy a code-signing certificate (SmartScreen warning today).
3. Have a CA verify the Maharashtra excise registers and GST invoice format.
4. Customer paperwork: licence agreement, support number, Marathi/Hindi/English guide, pricing.
5. Tighten CSP (currently null), add crash reporting.
6. Later: multi-computer/cloud sync, owner mobile view.
