CREATE TABLE IF NOT EXISTS weeks (
    id         UUID PRIMARY KEY,
    user_id    TEXT        NOT NULL,
    starts_on  DATE        NOT NULL,
    ends_on    DATE        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'review', 'closed')),
    started_at TIMESTAMPTZ,
    closed_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (EXTRACT(ISODOW FROM starts_on) = 1),
    CHECK (EXTRACT(ISODOW FROM ends_on) = 7),
    CHECK (ends_on = starts_on + INTERVAL '6 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_weeks_user_window
    ON weeks(user_id, starts_on, ends_on);

CREATE UNIQUE INDEX IF NOT EXISTS ux_weeks_single_open
    ON weeks(user_id)
    WHERE status IN ('planning', 'active', 'review');

CREATE TABLE IF NOT EXISTS week_priorities (
    id          UUID PRIMARY KEY,
    week_id     UUID        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    text        TEXT        NOT NULL,
    order_index INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_week_priorities_week_order
    ON week_priorities(week_id, order_index, created_at);

CREATE TABLE IF NOT EXISTS task_week_allocations (
    id                  UUID PRIMARY KEY,
    task_id             UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    week_id             UUID        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    day_of_week         SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    slot_minute_of_day  INTEGER     CHECK (
        slot_minute_of_day IS NULL OR (
            slot_minute_of_day >= 0 AND
            slot_minute_of_day < 1440 AND
            MOD(slot_minute_of_day, 15) = 0
        )
    ),
    lane                TEXT        NOT NULL CHECK (lane IN ('daily_priority', 'timeslot')),
    status_snapshot     TEXT        NOT NULL DEFAULT 'planned' CHECK (status_snapshot IN ('planned', 'done', 'moved', 'backlog')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, week_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_week_day_lane_slot
    ON task_week_allocations(week_id, day_of_week, lane, slot_minute_of_day, created_at);

CREATE INDEX IF NOT EXISTS idx_allocations_task
    ON task_week_allocations(task_id);