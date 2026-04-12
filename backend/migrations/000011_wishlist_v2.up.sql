ALTER TABLE wishlist_items
    ADD COLUMN bought_at TIMESTAMPTZ,
    RENAME COLUMN importance TO impact;

ALTER TABLE wishlist_items
    ALTER COLUMN impact SET DEFAULT 3,
    ALTER COLUMN currency SET DEFAULT 'MXN';

ALTER TABLE wishlist_items
    DROP CONSTRAINT IF EXISTS wishlist_items_importance_check,
    ADD CONSTRAINT wishlist_items_impact_check CHECK (impact BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS wishlist_items_user_bought_idx ON wishlist_items(user_id, bought_at);
