CREATE TYPE account_type AS ENUM ('checking', 'savings', 'cash', 'investment', 'credit_card', 'other');

CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS accounts (
    id         UUID PRIMARY KEY,
    user_id    TEXT          NOT NULL,
    name       TEXT          NOT NULL,
    type       account_type  NOT NULL DEFAULT 'checking',
    currency   TEXT          NOT NULL DEFAULT 'USD',
    balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id          UUID             PRIMARY KEY,
    account_id  UUID             NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    user_id     TEXT             NOT NULL,
    type        transaction_type NOT NULL,
    amount      NUMERIC(15,2)    NOT NULL,
    currency    TEXT             NOT NULL DEFAULT 'USD',
    category    TEXT             NOT NULL DEFAULT '',
    role_id     UUID             REFERENCES roles(id) ON DELETE SET NULL,
    description TEXT             NOT NULL DEFAULT '',
    date        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(date);

CREATE TABLE IF NOT EXISTS transaction_splits (
    id             UUID          PRIMARY KEY,
    transaction_id UUID          NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category       TEXT          NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    percentage     NUMERIC(5,2)  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_txid ON transaction_splits(transaction_id);

CREATE TABLE IF NOT EXISTS transfers (
    id              UUID          PRIMARY KEY,
    user_id         TEXT          NOT NULL,
    from_account_id UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id   UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount          NUMERIC(15,2) NOT NULL,
    currency        TEXT          NOT NULL DEFAULT 'USD',
    description     TEXT          NOT NULL DEFAULT '',
    date            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_id         ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account_id ON transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account_id   ON transfers(to_account_id);
