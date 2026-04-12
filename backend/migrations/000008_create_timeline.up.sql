-- Timeline events: immutable audit log of life events across all domains.
CREATE TABLE timeline_events (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     TEXT        NOT NULL,
    event_type  TEXT        NOT NULL,
    domain      TEXT        NOT NULL,
    entity_id   UUID,
    payload     JSONB       NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX timeline_events_user_id_idx       ON timeline_events(user_id);
CREATE INDEX timeline_events_occurred_at_idx   ON timeline_events(user_id, occurred_at DESC);
CREATE INDEX timeline_events_event_type_idx    ON timeline_events(user_id, event_type);
