DROP INDEX IF EXISTS ux_weeks_single_active;

CREATE UNIQUE INDEX IF NOT EXISTS ux_weeks_single_open
    ON weeks(user_id)
    WHERE status IN ('planning', 'active', 'review');
