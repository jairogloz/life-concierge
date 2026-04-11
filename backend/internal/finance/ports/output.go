package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/finance/domain"
)

// FinanceRepository defines the driven port (persistence interface) for the finance domain.
type FinanceRepository interface {
	// Accounts
	CreateAccount(ctx context.Context, acc *domain.Account) error
	ListAccounts(ctx context.Context, userID string) ([]*domain.Account, error)
	GetAccountByID(ctx context.Context, userID, id string) (*domain.Account, error)
	UpdateAccountBalance(ctx context.Context, id string, delta float64) error

	// Transactions
	CreateTransaction(ctx context.Context, tx *domain.Transaction) error
	CreateTransactionSplits(ctx context.Context, splits []domain.TransactionSplit) error
	ListTransactions(ctx context.Context, userID, accountID string) ([]*domain.Transaction, error)
	GetTransactionSplits(ctx context.Context, txID string) ([]domain.TransactionSplit, error)

	// Transfers
	CreateTransfer(ctx context.Context, tr *domain.Transfer) error

	// Summary
	GetBalanceSum(ctx context.Context, userID string) (float64, error)
	GetMonthlyTotals(ctx context.Context, userID string) (income, expenses float64, err error)
	GetMonthlyByCategory(ctx context.Context, userID string) (map[string]float64, error)
}
