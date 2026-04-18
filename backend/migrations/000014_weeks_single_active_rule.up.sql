DROP INDEX IF EXISTS ux_weeks_single_open;

CREATE UNIQUE INDEX IF NOT EXISTS ux_weeks_single_active
    ON weeks(user_id)
    WHERE status = 'active';
