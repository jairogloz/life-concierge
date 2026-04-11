-- Wishlist items: potential purchases awaiting AI evaluation.
CREATE TABLE wishlist_items (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           TEXT        NOT NULL,
    title             TEXT        NOT NULL,
    price             NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency          TEXT        NOT NULL DEFAULT 'USD',
    role_id           UUID        REFERENCES roles(id) ON DELETE SET NULL,
    goal_id           UUID        REFERENCES goals(id) ON DELETE SET NULL,
    importance        SMALLINT    NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    roi_score         NUMERIC(4,2),
    emotional_score   NUMERIC(4,2),
    cooldown_days     INT         NOT NULL DEFAULT 30,
    verdict           TEXT        CHECK (verdict IN ('buy_now', 'wait', 'reject', 'replace')),
    verdict_reasoning TEXT,
    evaluated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX wishlist_items_user_id_idx ON wishlist_items(user_id);
