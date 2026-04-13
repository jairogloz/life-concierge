CREATE TABLE user_streaks (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            TEXT NOT NULL,
    scope_type         TEXT NOT NULL CHECK (scope_type IN ('global', 'role')),
    role_id            UUID REFERENCES roles(id) ON DELETE CASCADE,
    scope_key          TEXT NOT NULL,
    current_streak     INT NOT NULL DEFAULT 0,
    longest_streak     INT NOT NULL DEFAULT 0,
    last_activity_date DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, scope_key)
);

CREATE TABLE xp_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     TEXT NOT NULL,
    source      TEXT NOT NULL,
    xp_amount   INT NOT NULL CHECK (xp_amount > 0),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE achievements (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      TEXT NOT NULL,
    code         TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, code)
);

CREATE INDEX user_streaks_user_id_idx ON user_streaks(user_id);
CREATE INDEX xp_log_user_created_idx ON xp_log(user_id, created_at DESC);
CREATE INDEX achievements_user_unlocked_idx ON achievements(user_id, unlocked_at DESC);
