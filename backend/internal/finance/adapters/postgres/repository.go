package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/finance/domain"
	"github.com/jairogloz/life-concierge/internal/finance/ports"
)

// FinanceRepository is a PostgreSQL implementation of ports.FinanceRepository.
type FinanceRepository struct {
	db *pgxpool.Pool
}

// NewFinanceRepository creates a new PostgreSQL-backed FinanceRepository.
func NewFinanceRepository(db *pgxpool.Pool) *FinanceRepository {
	return &FinanceRepository{db: db}
}

// scanner is satisfied by both pgx.Row and pgx.Rows.
type scanner interface {
	Scan(dest ...any) error
}

// ── Accounts ─────────────────────────────────────────────────────────────────

const accountCols = `id, user_id, name, type, currency, balance, created_at, updated_at`

func (r *FinanceRepository) CreateAccount(ctx context.Context, acc *domain.Account) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO accounts (`+accountCols+`) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		acc.ID, acc.UserID, acc.Name, acc.Type, acc.Currency, acc.Balance,
		acc.CreatedAt, acc.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("accounts.Create: %w", err)
	}
	return nil
}

func (r *FinanceRepository) ListAccounts(ctx context.Context, userID string) ([]*domain.Account, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+accountCols+` FROM accounts WHERE user_id=$1 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("accounts.List: %w", err)
	}
	defer rows.Close()

	var accounts []*domain.Account
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func (r *FinanceRepository) GetAccountByID(ctx context.Context, userID, id string) (*domain.Account, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+accountCols+` FROM accounts WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return scanAccount(row)
}

func (r *FinanceRepository) UpdateAccountBalance(ctx context.Context, id string, delta float64) error {
	_, err := r.db.Exec(ctx,
		`UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
		delta, id,
	)
	return err
}

func scanAccount(row scanner) (*domain.Account, error) {
	var a domain.Account
	err := row.Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Currency, &a.Balance,
		&a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrAccountNotFound
		}
		return nil, fmt.Errorf("accounts.scan: %w", err)
	}
	return &a, nil
}

// ── Transactions ──────────────────────────────────────────────────────────────

const txCols = `id, account_id, user_id, type, amount, currency, category, role_id, description, date, created_at, updated_at`

func (r *FinanceRepository) CreateTransaction(ctx context.Context, tx *domain.Transaction) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO transactions (`+txCols+`) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		tx.ID, tx.AccountID, tx.UserID, tx.Type, tx.Amount, tx.Currency,
		tx.Category, tx.RoleID, tx.Description, tx.Date, tx.CreatedAt, tx.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("transactions.Create: %w", err)
	}
	return nil
}

func (r *FinanceRepository) CreateTransactionSplits(ctx context.Context, splits []domain.TransactionSplit) error {
	for _, s := range splits {
		_, err := r.db.Exec(ctx,
			`INSERT INTO transaction_splits (id, transaction_id, category, amount, percentage)
			 VALUES ($1,$2,$3,$4,$5)`,
			s.ID, s.TransactionID, s.Category, s.Amount, s.Percentage,
		)
		if err != nil {
			return fmt.Errorf("transaction_splits.Create: %w", err)
		}
	}
	return nil
}

func (r *FinanceRepository) ListTransactions(ctx context.Context, userID, accountID string) ([]*domain.Transaction, error) {
	query := `SELECT ` + txCols + ` FROM transactions WHERE user_id=$1`
	args := []any{userID}
	if accountID != "" {
		query += ` AND account_id=$2`
		args = append(args, accountID)
	}
	query += ` ORDER BY date DESC, created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("transactions.List: %w", err)
	}
	defer rows.Close()

	var txns []*domain.Transaction
	for rows.Next() {
		tx, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		txns = append(txns, tx)
	}
	return txns, rows.Err()
}

func (r *FinanceRepository) GetTransactionSplits(ctx context.Context, txID string) ([]domain.TransactionSplit, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, transaction_id, category, amount, percentage
		   FROM transaction_splits WHERE transaction_id=$1`,
		txID,
	)
	if err != nil {
		return nil, fmt.Errorf("transaction_splits.List: %w", err)
	}
	defer rows.Close()

	var splits []domain.TransactionSplit
	for rows.Next() {
		var s domain.TransactionSplit
		if err := rows.Scan(&s.ID, &s.TransactionID, &s.Category, &s.Amount, &s.Percentage); err != nil {
			return nil, fmt.Errorf("transaction_splits.scan: %w", err)
		}
		splits = append(splits, s)
	}
	return splits, rows.Err()
}

func scanTransaction(row scanner) (*domain.Transaction, error) {
	var t domain.Transaction
	err := row.Scan(
		&t.ID, &t.AccountID, &t.UserID, &t.Type, &t.Amount, &t.Currency,
		&t.Category, &t.RoleID, &t.Description, &t.Date, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("transactions.scan: %w", err)
	}
	return &t, nil
}

// ── Transfers ─────────────────────────────────────────────────────────────────

func (r *FinanceRepository) CreateTransfer(ctx context.Context, tr *domain.Transfer) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO transfers (id, user_id, from_account_id, to_account_id, amount, currency, description, date, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		tr.ID, tr.UserID, tr.FromAccountID, tr.ToAccountID, tr.Amount,
		tr.Currency, tr.Description, tr.Date, tr.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("transfers.Create: %w", err)
	}
	return nil
}

// ── Summary ───────────────────────────────────────────────────────────────────

func (r *FinanceRepository) GetBalanceSum(ctx context.Context, userID string) (float64, error) {
	var sum float64
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE user_id=$1`,
		userID,
	).Scan(&sum)
	return sum, err
}

func (r *FinanceRepository) GetMonthlyTotals(ctx context.Context, userID string) (income, expenses float64, err error) {
	rows, err := r.db.Query(ctx,
		`SELECT type, COALESCE(SUM(amount), 0)
		   FROM transactions
		  WHERE user_id=$1
		    AND date >= date_trunc('month', NOW())
		  GROUP BY type`,
		userID,
	)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var t domain.TransactionType
		var total float64
		if err := rows.Scan(&t, &total); err != nil {
			return 0, 0, err
		}
		if t == domain.TransactionTypeIncome {
			income = total
		} else {
			expenses = total
		}
	}
	return income, expenses, rows.Err()
}

func (r *FinanceRepository) GetMonthlyByCategory(ctx context.Context, userID string) (map[string]float64, error) {
	rows, err := r.db.Query(ctx,
		`SELECT category, COALESCE(SUM(amount), 0)
		   FROM transactions
		  WHERE user_id=$1
		    AND type='expense'
		    AND date >= date_trunc('month', NOW())
		  GROUP BY category
		  ORDER BY SUM(amount) DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]float64)
	for rows.Next() {
		var cat string
		var total float64
		if err := rows.Scan(&cat, &total); err != nil {
			return nil, err
		}
		result[cat] = total
	}
	return result, rows.Err()
}

// Ensure FinanceRepository satisfies the port interface at compile time.
var _ ports.FinanceRepository = (*FinanceRepository)(nil)
