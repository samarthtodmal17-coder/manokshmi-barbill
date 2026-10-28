# Manokshmi BarBill – UX Review & Improvement Roadmap

Basis: code and screen review of v0.1.7 (10 screens, 8 Setup tabs, ~10,000 lines of UI). Not based on watching a real cashier use it on a live shift – items marked (verify) should be confirmed with 2–3 real users.

## What is already good (keep)
Dark theme, full keyboard flow on the billing screen (F2/F3/F4, Alt+1-4, Ctrl+Enter), colour-coded payment buttons, table status colours, KOT, split payment, move/merge table, Marathi toggle, low-stock card, Enter-to-advance in forms, health check.

## P1 – Do first (biggest daily-time and error savings)

| # | Issue found | Improvement |
|---|---|---|
| 1 | **Dashboard is passive.** 6 numbers + 4 tiles; nothing tells the owner what needs action. | Add "Needs attention" strip: unclosed day, low stock, bills on credit overdue, vendor dues, POs pending, backup not taken in 3 days – each a one-click link. |
| 2 | **No first-run setup guide.** New customer lands on an empty dashboard. | 5-step checklist (Business name/GST → Categories → Items → Opening stock → First bill) with progress bar; hides when done. |
| 3 | **Native pop-ups.** 24 `confirm()` and 5 `alert()` dialogs – plain, look foreign, Enter/Esc behaviour inconsistent, can't show details. | One custom confirm dialog (Enter = confirm, Esc = cancel, red button for destructive, shows what will be affected e.g. "Delete bill INV-102 – ₹1,240, restores stock"). |
| 4 | **Destructive actions have little recovery.** Only 6 "undo" mentions. | "Undo" toast (8 s) for item delete, bill line remove, table clear, payment entry; Bill delete → Recycle bin for 30 days. |
| 5 | **Billing keyboard help is one long line of 14 shortcuts** (line ~894) – unreadable on shift. | Replace by `?` / F1 cheat-sheet overlay; keep only 4 key hints on screen. |
| 6 | **Zero accessibility labels** (0 `aria-label`, 0 `role`): icon-only buttons unreadable to tools, poor focus order. | Add labels to icon buttons; visible focus ring; logical Tab order. |
| 7 | **Text size fixed** (49 spots at 10–11 px). Hard for older staff / far screens. | A/A+ text-size setting (100/115/130 %) stored per PC; raise minimum font to 12 px. |
| 8 | **No auto-save indicator / save feedback** (0 mentions). Owners worry "was it saved?" | Small "Saved ✓ 10:42" status in the header; red warning if save fails. |
| 9 | **Staff PIN/auto-lock** – confirm an idle auto-lock exists for the till (verify). | Auto-lock after N minutes with quick PIN re-entry (no full logout). |

## P2 – Billing screen efficiency
1. **Fast items grid**: pin 12–20 "favourite" items as big buttons (touch-friendly; today it relies on search/typing). Auto-favourites = top 20 sold in last 30 days.
2. **Repeat last order** / "same again" button per table (bars reorder constantly).
3. **Cash tendered + change due**: big keypad with quick notes (₹100/200/500/2000) and the change shown huge.
4. **Hold & recall** bill with a name label (e.g. "Rahul – table 4 – coming back").
5. **Item notes/modifiers** on KOT ("no ice", "less spicy") as one-tap chips.
6. **Peg selector** remembered per item (last used 30 ml/60 ml pre-selected).
7. **Tip / service charge** one-tap presets (5/10 %), per-bill toggle.
8. **Customer quick-add** inside billing for credit sales (no trip to Setup).
9. **Table map**: show running amount and time-seated on each table tile; highlight tables seated > 90 min.
10. **Zero-click printing option**: print KOT automatically when order is sent (setting).
11. **Barcode scanner beep/flash** feedback so the cashier knows a scan registered; clear "item not found – Add?" prompt.
12. **Discount reason** dropdown + manager PIN above a % limit (reduces leakage).

## P3 – Setup / data entry
1. **Bulk import/export items** via Excel template (CSV is present for some reports – extend to menu, vendors, customers).
2. **Sortable, filterable, sticky-header tables** everywhere (0 sortable columns today) – click column to sort, search box on every list.
3. **Inline edit everywhere** with visible edit affordance (the Food menu table needed a fix for this – apply same pattern to Liquor, vendors, customers) and Tab/Enter to next row.
4. **Duplicate item** button (clone size/price variants: 180/375/750 ml).
5. **Price-change history** per item and "effective from" date.
6. **Inline validation messages** next to the field instead of toast-only errors.
7. **Smart defaults**: category sets GST %, excise flag, KOT destination automatically (partly done – make it visible in the form).
8. **Setup tab count (8) → grouped**: "Menu", "People" (staff/customers/vendors), "Business", "Data" (backup/health/Marathi). Fewer top-level choices.

## P4 – Stock, purchase, reports
1. **Stock count mode**: scan/enter physical count, app shows variance and posts adjustment in one go.
2. **Reorder → PO in one click**: low-stock list with "Create PO for selected" using last vendor and last rate.
3. **Purchase entry**: remember last rate per vendor/item; flag if rate differs > 10 %.
4. **Reports**: default to "Today / Yesterday / This month" chips instead of two date pickers; remember last range; export PDF/Excel on every report.
5. **Daily closing wizard**: step-by-step (count cash → expenses → compare → lock day) with a printable summary; warn if previous day not closed.
6. **Dashboard charts**: 7-day sales trend, top 5 items, peak hours – owners check these on phone/WhatsApp.
7. **Share on WhatsApp** daily closing summary (WhatsApp links exist for bills – extend to closing).
8. **Credit ledger**: ageing buckets (0–7, 8–30, 30+ days) and one-tap reminder message.

## P5 – Trust, polish, support
1. **Empty states with a next action** ("No customers yet – Add customer").
2. **Consistent date format** (DD/MM/YYYY) and ₹ formatting with thousands separators (Indian lakh grouping) everywhere.
3. **Loading/progress** for backup, import, update download; "Update available – install now/later" banner.
4. **In-app help**: "?" on each screen linking to a 1-page guide; contact/WhatsApp support button; app version + licence expiry shown in footer.
5. **Responsive layout**: only two breakpoints (900/1280 px); test at 1366×768 laptop and 125 % Windows scaling (verify – the most common bar PC).
6. **Sounds** (optional): soft beep on save/error.
7. **Audit-friendly**: show "edited by / when" on bills in history.
8. **Backup reminders** with one-click "Backup now to USB/Drive".

## Suggested release plan
- **0.2.0 (Trust & guidance):** #1–#5, #8, P5-1, P5-2 – dashboard attention strip, first-run checklist, custom dialogs, undo, shortcut cheat-sheet, save indicator.
- **0.3.0 (Speed at the till):** P2 items 1, 2, 3, 4, 9, 11 + text-size setting + accessibility labels.
- **0.4.0 (Back-office):** P3 import/sort/filter, P4 stock count, reorder→PO, closing wizard.
- **0.5.0 (Insights):** dashboard charts, ageing, WhatsApp closing summary.

## How to validate (before building)
Sit with 3 real users (cashier, owner, stock person) for one shift each; time 5 tasks: bill 5 items, change an item price, receive a purchase, close the day, find yesterday's bill. Record taps/seconds; target −30 % after 0.3.0.

## Not assessed
Printed receipt layout on real printers, touch-screen behaviour, real WebView rendering, installer/update experience.

---

# UI / Visual Design Review (designer view)

Findings come from the app's stylesheet and markup (v0.1.7).

## Current design system – what exists
- Palette: navy `#132043`, gold `#c9982f`, success green `#1f8a52`, danger `#c0392b`; light and dark themes via CSS variables. Good brand base.
- Font: system stack (Segoe UI on Windows) with Nirmala/Mangal for Marathi. Fine and fast.
- Tokens exist for colour, radius (12px) and shadows, but **not for type size, spacing or component states**.

## Problems found
| # | Problem | Evidence | Fix |
|---|---|---|---|
| D1 | **Too many font sizes, many too small** | 12 different sizes (7–26 px); 44 uses of 11 px and 15+ uses of 7–10 px | Define a 6-step type scale: 12 / 14 / 16 / 18 / 22 / 28 px. Minimum 12 px; body 14 px; money amounts 18+ px bold with tabular numbers |
| D2 | **Inconsistent corner radii** | 5, 6, 7, 8, 9, 10, 12 px all in use | 3 tokens only: 6 (inputs, chips), 10 (buttons, cards), 16 (modals) |
| D3 | **Inline styles everywhere** | 418 `style="..."` attributes | Move to classes (`.row`, `.stack`, `.muted`, `.w-full`). Makes theming, text-size setting and consistency possible |
| D4 | **No spacing scale** | Margins like 6/8/12/14px mixed freely | 4-pt scale: 4, 8, 12, 16, 24, 32 |
| D5 | **Gold is used for the main action, green for Save & Print** | Billing primary button is green; other screens use gold | One rule: **Primary = gold-filled, Confirm money/Save = green, Destructive = red outline, Secondary = grey outline**. Max one primary per screen |
| D6 | **Number alignment** | Amounts in tables are not guaranteed right-aligned/tabular | Right-align all money columns, `font-variant-numeric: tabular-nums`, Indian grouping (1,23,456.00), ₹ symbol lighter weight |
| D7 | **Status shown by colour only** | Table map, stock levels | Add icon or text to every colour (Occupied, Billed, Low, Out) – also helps colour-blind users and B/W receipts |
| D8 | **Touch targets** | Qty buttons are 28×28 px | Minimum 40×40 px on billing (44 px if touch screen mode on). Add "Touch mode" toggle that scales buttons/rows up |
| D9 | **Dense forms** | Setup forms are long single blocks | Group into labelled sections (Basic / Pricing / Stock / Tax) in 2-column grid, labels above fields, required marked with `*`, helper text in grey below |
| D10 | **Icon-only items need labels** | Stat-card icons, toolbar icons | Show text label beside icons; tooltip on hover; keep icon size consistent (20 px, 2 px stroke – already the style) |
| D11 | **Dark-theme contrast** | Muted text `#8b93ac` on `#161c2c` ≈ 5.6:1 (OK); light-theme muted `#6b7284` on white ≈ 4.8:1 (borderline) | Darken light muted to `#5a6176`; target WCAG AA (4.5:1) for all text |
| D12 | **Sidebar** | 10 items, flat | Group: *Sell* (Billing, Bill History) · *Stock* (Stock, Purchase, Purchase Orders) · *Money* (Expenses, Ledger, Reports) · *Admin* (Setup). Show tooltip + badge counts (e.g. low-stock 5) |
| D13 | **Top bar** | Little context | Show: business name, today's date, shift/user, Saved ✓ indicator, theme toggle, language (EN/मराठी), update badge |
| D14 | **Modals** | Stack of different widths and button orders | One modal spec: 480/640/880 px widths; title left, ✕ right; footer buttons right-aligned: *Cancel* then *Primary*; Enter = primary, Esc = close; focus first field |
| D15 | **Toasts** | Position/duration vary | Bottom-right, 4 s (errors 8 s, stay until closed), colour + icon, with Undo action where relevant |
| D16 | **Tables (lists)** | Plain rows | Sticky header, zebra or hover highlight, row height 40 px, selected row accent, sortable headers, sticky totals row, empty-state illustration + action |
| D17 | **Receipt design** | Printed on thermal paper | Check: business name 1.5x, bill no/date bold, item rows aligned (qty × rate = amount), totals bold, GST breakup, footer thank-you in English + Marathi (verify on real printer) |

## Proposed screen redesigns (wireframe descriptions)

**1. Dashboard (owner view)**
- Row 1: greeting + date + "Day status: Open / Closed" button.
- Row 2: 4 KPI cards (Sales, Bills, Cash in drawer, Credit given) each with ▲▼ % vs yesterday.
- Row 3: left = 7-day sales line chart; right = "Needs attention" list (low stock, dues, pending POs, backup).
- Row 4: Top 5 items today · Payment-mode split donut · Peak-hour bars.
- Quick actions become a compact button row, not big tiles.

**2. Billing (cashier view) – three columns**
- Left (22%): table grid – each tile shows number, amount, minutes seated, status colour+icon; filter by zone chips.
- Centre (46%): search bar on top → category chips → **favourites grid of large item buttons** (price on button, stock badge when low).
- Right (32%): bill panel – customer chip, lines (qty stepper 40 px, swipe/✕ delete), totals; sticky footer with **big Total**, payment-mode chips, and one large *Save & Print* button; *KOT* and *Hold* secondary.
- Cash flow: choose Cash → numeric pad with ₹ quick notes → change due shown in 40 px type.

**3. Setup → Menu**
- Left: category list with counts and drag-to-reorder. Right: item table (sortable, inline edit) with search and bulk-select bar (Change rate %, Move category, Enable tracking).
- "Add item" opens a right-side drawer (not a new page) with grouped sections; Enter saves and keeps drawer open for rapid entry ("Save & add next").

**4. Stock**
- Tabs: Overview · Counter ↔ Godown transfer · Count · Log. Overview shows traffic-light bars per item (qty vs reorder level).

**5. Reports**
- Left: report list; top: date chips (Today, Yesterday, 7 days, Month, Custom); content: summary tiles then table; fixed Export/Print buttons top-right.

## Component library to standardise (build once, reuse)
Button (primary/secondary/danger/ghost, sizes S/M/L, loading state) · Input/Select/Textarea (default, focus, error, disabled) · Field (label, helper, error) · Card · Stat card · Chip/Badge · Table · Modal · Drawer · Toast · Confirm dialog · Empty state · Tabs · Stepper (qty) · Keypad.

## Interaction and motion rules
- Every action responds within 100 ms (pressed state), longer tasks show a spinner.
- Transitions 120–180 ms ease-out; no animation on the billing screen's main actions.
- Focus ring: 2 px gold, always visible for keyboard users.
- Never block with a pop-up when a toast will do; never use a toast when the user must decide.

## Design delivery plan
1. **Week 1 – Foundations:** tokens (type, spacing, radius, colour roles), contrast fixes, button/primary rules, min font 12 px, text-size & touch-mode toggles. Zero feature risk.
2. **Week 2 – Components:** custom confirm dialog, toast spec, modal spec, table spec, empty states. Replace the 24 native dialogs.
3. **Week 3 – Billing screen:** favourites grid, bigger steppers, change-due keypad, table tiles with timer.
4. **Week 4 – Dashboard + sidebar grouping + top bar.**
5. **Week 5 – Setup forms/drawer, reports date chips, polish, usability test with 3 users.**

Every phase must pass the existing automated suite (`npm test`) and a manual check at 1366×768 and 1920×1080, light and dark, English and Marathi (Marathi text is ~20 % longer – check no truncation).

## Success metrics
Time to create a 5-item bill (target −30 %), taps to change an item price (target ≤ 3), new-user first bill without help (target < 10 min), zero text below 12 px, all text AA contrast, support calls about "where is…" (target −50 %).
