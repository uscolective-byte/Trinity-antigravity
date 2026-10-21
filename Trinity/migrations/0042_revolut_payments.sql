CREATE TABLE IF NOT EXISTS ops_revolut_payments (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('sandbox','production')),
 product_id TEXT NOT NULL,
 description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 currency TEXT NOT NULL CHECK(currency='EUR'),
 provider_order_id TEXT,
 checkout_url TEXT,
 state TEXT NOT NULL DEFAULT 'creating',
 payment_confirmed INTEGER NOT NULL DEFAULT 0,
 refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
 verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(owner_id,mode,request_key),
 UNIQUE(mode,provider_order_id)
);
