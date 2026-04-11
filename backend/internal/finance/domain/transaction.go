package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrTransactionNotFound is returned when a transaction cannot be found.
var ErrTransactionNotFound = errors.New("transaction not found")

// TransactionType identifies whether money flows in or out.
type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeExpense TransactionType = "expense"
)

// TransactionSplit represents a portion of a transaction split across categories.
type TransactionSplit struct {
	ID            string  `json:"id"`
	TransactionID string  `json:"transaction_id"`
	Category      string  `json:"category"`
	Amount        float64 `json:"amount"`
	Percentage    float64 `json:"percentage"`
}

// Transaction represents a single financial movement on an account.
type Transaction struct {
	ID          string            `json:"id"`
	AccountID   string            `json:"account_id"`
	UserID      string            `json:"user_id"`
	Type        TransactionType   `json:"type"`
	Amount      float64           `json:"amount"`
	Currency    string            `json:"currency"`
	Category    string            `json:"category"`
	RoleID      *string           `json:"role_id,omitempty"`
	Description string            `json:"description"`
	Date        time.Time         `json:"date"`
	Splits      []TransactionSplit `json:"splits,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Validate checks all required fields and business rules.
func (t *Transaction) Validate() error {
	if t.AccountID == "" {
		return fmt.Errorf("validation: account_id is required")
	}
	if t.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if t.Type != TransactionTypeIncome && t.Type != TransactionTypeExpense {
		return fmt.Errorf("validation: type must be income or expense")
	}
	if t.Amount <= 0 {
		return fmt.Errorf("validation: amount must be greater than 0")
	}
	if t.Currency == "" {
		return fmt.Errorf("validation: currency is required")
	}
	// Validate splits total equals transaction amount (within rounding tolerance).
	if len(t.Splits) > 0 {
		var total float64
		for _, s := range t.Splits {
			total += s.Amount
		}
		diff := total - t.Amount
		if diff < -0.01 || diff > 0.01 {
			return fmt.Errorf("validation: splits total (%.2f) must equal transaction amount (%.2f)", total, t.Amount)
		}
	}
	return nil
}
