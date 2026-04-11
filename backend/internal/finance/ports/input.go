package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/finance/domain"
)

// CreateAccountParams holds parameters for creating a new account.
type CreateAccountParams struct {
	UserID   string
	Name     string
	Type     domain.AccountType
	Currency string
	Balance  float64
}

// SplitInput represents one segment of a split transaction.
type SplitInput struct {
	Category   string
	Amount     float64
	Percentage float64
}

// CreateTransactionParams holds parameters for creating a transaction.
type CreateTransactionParams struct {
	AccountID   string
	UserID      string
	Type        domain.TransactionType
	Amount      float64
	Currency    string
	Category    string
	RoleID      *string
	Description string
	Date        *time.Time
	Splits      []SplitInput
}

// CreateTransferParams holds parameters for creating a transfer.
type CreateTransferParams struct {
	UserID        string
	FromAccountID string
	ToAccountID   string
	Amount        float64
	Currency      string
	Description   string
	Date          *time.Time
}

// FinanceService defines the input port for the finance domain.
type FinanceService interface {
	CreateAccount(ctx context.Context, params CreateAccountParams) (*domain.Account, error)
	ListAccounts(ctx context.Context, userID string) ([]*domain.Account, error)

	CreateTransaction(ctx context.Context, params CreateTransactionParams) (*domain.Transaction, error)
	ListTransactions(ctx context.Context, userID, accountID string) ([]*domain.Transaction, error)

	CreateTransfer(ctx context.Context, params CreateTransferParams) (*domain.Transfer, error)

	GetSummary(ctx context.Context, userID string) (*domain.FinanceSummary, error)
}
