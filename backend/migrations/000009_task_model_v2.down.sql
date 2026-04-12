ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_impact_range;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_effort_range;

DROP INDEX IF EXISTS idx_tasks_scheduled_date;
DROP INDEX IF EXISTS idx_tasks_task_type;

-- Restore old enum and columns
CREATE TYPE commitment_type AS ENUM ('commitment', 'habit', 'recurring', 'intention');

ALTER TABLE tasks
    ADD COLUMN urgency         NUMERIC(4,2)    NOT NULL DEFAULT 5.0,
    ADD COLUMN commitment_type commitment_type NOT NULL DEFAULT 'intention';

-- Scale impact (1–5) back to urgency (1–10)
UPDATE tasks SET urgency = impact * 2.0;

ALTER TABLE tasks
    DROP COLUMN task_type,
    DROP COLUMN impact,
    DROP COLUMN scheduled_date,
    DROP COLUMN soft_deadline,
    DROP COLUMN effort,
    DROP COLUMN estimated_minutes,
    DROP COLUMN completion_log;

DROP TYPE task_type;
