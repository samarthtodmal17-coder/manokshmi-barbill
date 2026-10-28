# Manokshmi BarBill – automated tests

Run everything:  `npm test`   (needs Node 22+, no other installs)

| File | What it checks |
|---|---|
| audit-wiring.mjs | Static audit: every button/data-action the app creates is really connected; no missing element ids |
| menu-sync.test.mjs | Menu edits ↔ running bills, purchase orders, stock, categories, health check |
| billing.test.mjs | Table/item entry, totals, cash/credit/split, KOT, stock deduction, bill numbers |
| stock-ledger.test.mjs | Opening stock, wastage, transfer, payments, expenses, PO receive, purchase delete |
| reports.test.mjs | Daily closing, P&L, GST split, excise register arithmetic, every report runs |
| staff-setup.test.mjs | Staff accounts, PIN lockout, role limits, zones/tables, backup → restore |
| more-flows.test.mjs | Bill editor, move/merge table, PO cancel, dashboard numbers |
| menu-entry.test.mjs | Keyboard chooser, multi-size liquor entry, categories, item list buttons |
| ui-wiring.test.mjs | Clicks the real list buttons: stock groups, transfer, reorder→PO, PO actions, excise count, item and food tables, ledger |
| crash-sweep.test.mjs | Opens every screen and presses ~2,700 buttons; fails on any exception |
| test-adapter.mjs | SQLite storage layer |

The tests run the real `www/index.html` inside a small fake browser (`dom.mjs`, `harness.mjs`).
They do not test printing, the Windows installer, the licence server or the screen layout – those need a real Windows run.

## Added in the deep-test round
- `fuzz.test.mjs` - random business days (seeded); checks stock/ledger/credit/excise/health invariants after every step.
- `marathi.test.mjs` - Marathi toggle, translated names, Marathi Names list.
- `perf.test.mjs` - speed with 15,000 bills and 400 items.
