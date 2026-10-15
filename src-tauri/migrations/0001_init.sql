-- Migration 0001: key-value store.
-- Manokshmi BarBill keeps each top-level data collection (bills, items,
-- stockLog, ...) as one JSON value under its own key, exactly as the app did
-- in browser IndexedDB. Never edit this file after release; add 0002_*.sql.
CREATE TABLE IF NOT EXISTS kv (
  "key" TEXT PRIMARY KEY NOT NULL,
  "value" TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
