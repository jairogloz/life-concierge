DROP INDEX IF EXISTS wishlist_items_user_bought_idx;

ALTER TABLE wishlist_items
    DROP CONSTRAINT IF EXISTS wishlist_items_impact_check,
    RENAME COLUMN impact TO importance;

ALTER TABLE wishlist_items
    ALTER COLUMN importance SET DEFAULT 5,
    ALTER COLUMN currency SET DEFAULT 'USD';

ALTER TABLE wishlist_items
    ADD CONSTRAINT wishlist_items_importance_check CHECK (importance BETWEEN 1 AND 10);

ALTER TABLE wishlist_items
    DROP COLUMN IF EXISTS bought_at;
