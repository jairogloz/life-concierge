CREATE TABLE roles (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    TEXT        NOT NULL,
    name       TEXT        NOT NULL,
    weight     NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    color      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX roles_user_id_idx ON roles (user_id);
