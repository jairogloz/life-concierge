package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/finance/domain"
	"github.com/jairogloz/life-concierge/internal/finance/ports"
	timelinedomain "github.com/jairogloz/life-concierge/internal/timeline/domain"
	timelineports "github.com/jairogloz/life-concierge/internal/timeline/ports"
)

// FinanceService implements ports.FinanceService.
type FinanceService struct {
	repo     ports.FinanceRepository
	timeline timelineports.TimelineService
}

// NewFinanceService creates a new FinanceService.
func NewFinanceService(repo ports.FinanceRepository) *FinanceService {
	return &FinanceService{repo: repo}
}

// SetTimeline wires the timeline service for event emission.
func (s *FinanceService) SetTimeline(tl timelineports.TimelineService) { s.timeline = tl }

// ── Accounts ─────────────────────────────────────────────────────────────────

func (s *FinanceService) CreateAccount(ctx context.Context, params ports.CreateAccountParams) (*domain.Account, error) {
	if params.Type == "" {
		params.Type = domain.AccountTypeChecking
	}
	if params.Currency == "" {
		params.Currency = "USD"
	}
	now := time.Now().UTC()
	acc := &domain.Account{
		ID:        uuid.New().String(),
		UserID:    params.UserID,
		Name:      params.Name,
		Type:      params.Type,
		Currency:  params.Currency,
		Balance:   params.Balance,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := acc.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.CreateAccount(ctx, acc); err != nil {
		return nil, fmt.Errorf("create account: %w", err)
	}
	return acc, nil
}

func (s *FinanceService) ListAccounts(ctx context.Context, userID string) ([]*domain.Account, error) {
	accounts, err := s.repo.ListAccounts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list accounts: %w", err)
	}
	return accounts, nil
}

// ── Transactions ──────────────────────────────────────────────────────────────

func (s *FinanceService) CreateTransaction(ctx context.Context, params ports.CreateTransactionParams) (*domain.Transaction, error) {
	now := time.Now().UTC()
	txDate := now
	if params.Date != nil {
		txDate = *params.Date
	}

	tx := &domain.Transaction{
		ID:          uuid.New().String(),
		AccountID:   params.AccountID,
		UserID:      params.UserID,
		Type:        params.Type,
		Amount:      params.Amount,
		Currency:    params.Currency,
		Category:    params.Category,
		RoleID:      params.RoleID,
		Description: params.Description,
		Date:        txDate,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	for _, sp := range params.Splits {
		tx.Splits = append(tx.Splits, domain.TransactionSplit{
			ID:            uuid.New().String(),
			TransactionID: tx.ID,
			Category:      sp.Category,
			Amount:        sp.Amount,
			Percentage:    sp.Percentage,
		})
	}

	if err := tx.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.CreateTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("create transaction: %w", err)
	}
	if len(tx.Splits) > 0 {
		if err := s.repo.CreateTransactionSplits(ctx, tx.Splits); err != nil {
			return nil, fmt.Errorf("create splits: %w", err)
		}
	}

	// Adjust account balance: income → +amount, expense → -amount.
	delta := tx.Amount
	if tx.Type == domain.TransactionTypeExpense {
		delta = -delta
	}
	if err := s.repo.UpdateAccountBalance(ctx, tx.AccountID, delta); err != nil {
		return nil, fmt.Errorf("update account balance: %w", err)
	}

	if tx.Type == domain.TransactionTypeExpense && s.timeline != nil {
		go func() {
			_, _ = s.timeline.RecordEvent(context.Background(), timelineports.RecordEventParams{
				UserID:    tx.UserID,
				EventType: timelinedomain.EventExpenseLogged,
				Domain:    "finance",
				EntityID:  &tx.ID,
				Payload:   map[string]any{"amount": tx.Amount, "category": tx.Category, "description": tx.Description},
			})
		}()
	}

	return tx, nil
}

func (s *FinanceService) ListTransactions(ctx context.Context, userID, accountID string) ([]*domain.Transaction, error) {
	txns, err := s.repo.ListTransactions(ctx, userID, accountID)
	if err != nil {
		return nil, fmt.Errorf("list transactions: %w", err)
	}
	for _, tx := range txns {
		splits, err := s.repo.GetTransactionSplits(ctx, tx.ID)
		if err != nil {
			return nil, fmt.Errorf("get splits: %w", err)
		}
		tx.Splits = splits
	}
	return txns, nil
}

// ── Transfers ─────────────────────────────────────────────────────────────────

func (s *FinanceService) CreateTransfer(ctx context.Context, params ports.CreateTransferParams) (*domain.Transfer, error) {
	now := time.Now().UTC()
	txDate := now
	if params.Date != nil {
		txDate = *params.Date
	}

	tr := &domain.Transfer{
		ID:            uuid.New().String(),
		UserID:        params.UserID,
		FromAccountID: params.FromAccountID,
		ToAccountID:   params.ToAccountID,
		Amount:        params.Amount,
		Currency:      params.Currency,
		Description:   params.Description,
		Date:          txDate,
		CreatedAt:     now,
	}

	if err := tr.Validate(); err != nil {
		return nil, err
	}

	// Verify both accounts belong to the user.
	if _, err := s.repo.GetAccountByID(ctx, params.UserID, params.FromAccountID); err != nil {
		if errors.Is(err, domain.ErrAccountNotFound) {
			return nil, fmt.Errorf("validation: from_account not found")
		}
		return nil, err
	}
	if _, err := s.repo.GetAccountByID(ctx, params.UserID, params.ToAccountID); err != nil {
		if errors.Is(err, domain.ErrAccountNotFound) {
			return nil, fmt.Errorf("validation: to_account not found")
		}
		return nil, err
	}

	if err := s.repo.CreateTransfer(ctx, tr); err != nil {
		return nil, fmt.Errorf("create transfer: %w", err)
	}

	if err := s.repo.UpdateAccountBalance(ctx, params.FromAccountID, -params.Amount); err != nil {
		return nil, fmt.Errorf("update from_account balance: %w", err)
	}
	if err := s.repo.UpdateAccountBalance(ctx, params.ToAccountID, params.Amount); err != nil {
		return nil, fmt.Errorf("update to_account balance: %w", err)
	}

	return tr, nil
}

// ── Summary ───────────────────────────────────────────────────────────────────

func (s *FinanceService) GetSummary(ctx context.Context, userID string) (*domain.FinanceSummary, error) {
	total, err := s.repo.GetBalanceSum(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("balance sum: %w", err)
	}
	income, expenses, err := s.repo.GetMonthlyTotals(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("monthly totals: %w", err)
	}
	byCategory, err := s.repo.GetMonthlyByCategory(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("monthly by category: %w", err)
	}
	return &domain.FinanceSummary{
		TotalBalance:  total,
		MonthIncome:   income,
		MonthExpenses: expenses,
		ByCategory:    byCategory,
	}, nil
}

// Ensure FinanceService satisfies the port interface at compile time.
var _ ports.FinanceService = (*FinanceService)(nil)
