-- Create task_type enum replacing commitment_type
CREATE TYPE task_type AS ENUM ('one_time', 'daily');

-- Add all new columns
ALTER TABLE tasks
    ADD COLUMN task_type          task_type  NOT NULL DEFAULT 'one_time',
    ADD COLUMN impact             SMALLINT   NOT NULL DEFAULT 3,
    ADD COLUMN scheduled_date     DATE,
    ADD COLUMN soft_deadline      DATE,
    ADD COLUMN effort             SMALLINT   NOT NULL DEFAULT 3,
    ADD COLUMN estimated_minutes  INTEGER,
    ADD COLUMN completion_log     JSONB      NOT NULL DEFAULT '[]';

-- Migrate urgency (1–10 numeric) → impact (1–5 int): scale down, clamp
UPDATE tasks SET impact = GREATEST(1, LEAST(5, CEIL(urgency / 2.0)::SMALLINT));

-- Drop old columns and enum type
ALTER TABLE tasks DROP COLUMN urgency;
ALTER TABLE tasks DROP COLUMN commitment_type;
DROP TYPE commitment_type;

-- Add CHECK constraints
ALTER TABLE tasks ADD CONSTRAINT tasks_impact_range CHECK (impact BETWEEN 1 AND 5);
ALTER TABLE tasks ADD CONSTRAINT tasks_effort_range CHECK (effort BETWEEN 1 AND 5);

-- Indexes for calendar + filtering queries
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type      ON tasks(user_id, task_type);
