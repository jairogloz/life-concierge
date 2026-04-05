CREATE TABLE IF NOT EXISTS ai_suggestions (
    id             UUID PRIMARY KEY,
    user_id        TEXT         NOT NULL,
    raw_text       TEXT         NOT NULL,
    suggestion     JSONB        NOT NULL,
    status         TEXT         NOT NULL DEFAULT 'pending',
    task_id        UUID         REFERENCES tasks(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_id ON ai_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status  ON ai_suggestions(status);
