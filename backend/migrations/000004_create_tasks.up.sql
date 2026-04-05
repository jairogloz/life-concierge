CREATE TYPE commitment_type AS ENUM ('commitment', 'habit', 'recurring', 'intention');

CREATE TABLE IF NOT EXISTS tasks (
    id               UUID PRIMARY KEY,
    user_id          TEXT           NOT NULL,
    primary_role_id  UUID           NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
    goal_id          UUID                    REFERENCES goals(id)  ON DELETE SET NULL,
    title            TEXT           NOT NULL,
    description      TEXT           NOT NULL DEFAULT '',
    commitment_type  commitment_type NOT NULL DEFAULT 'intention',
    context_tags     TEXT[]         NOT NULL DEFAULT '{}',
    urgency          NUMERIC(4,2)   NOT NULL DEFAULT 5.0,
    deadline         TIMESTAMPTZ,
    is_recurring     BOOLEAN        NOT NULL DEFAULT false,
    recurrence_rule  TEXT,
    status           TEXT           NOT NULL DEFAULT 'todo',
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_secondary_roles (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id         ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_primary_role_id ON tasks(primary_role_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id         ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks(status);
