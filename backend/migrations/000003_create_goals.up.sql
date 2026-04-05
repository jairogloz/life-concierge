CREATE TABLE IF NOT EXISTS goals (
    id             UUID PRIMARY KEY,
    user_id        TEXT        NOT NULL,
    role_id        UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    parent_goal_id UUID        REFERENCES goals(id) ON DELETE SET NULL,
    title          TEXT        NOT NULL,
    description    TEXT        NOT NULL DEFAULT '',
    weight         NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    status         TEXT        NOT NULL DEFAULT 'active',
    deadline       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_role_id ON goals(role_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON goals(parent_goal_id);
