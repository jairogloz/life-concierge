package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrTransferNotFound is returned when a transfer cannot be found.
var ErrTransferNotFound = errors.New("transfer not found")

// Transfer represents a movement of funds between two accounts.
type Transfer struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	FromAccountID string    `json:"from_account_id"`
	ToAccountID   string    `json:"to_account_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Description   string    `json:"description"`
	Date          time.Time `json:"date"`
	CreatedAt     time.Time `json:"created_at"`
}

// Validate checks all required fields and business rules.
func (t *Transfer) Validate() error {
	if t.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if t.FromAccountID == "" {
		return fmt.Errorf("validation: from_account_id is required")
	}
	if t.ToAccountID == "" {
		return fmt.Errorf("validation: to_account_id is required")
	}
	if t.FromAccountID == t.ToAccountID {
		return fmt.Errorf("validation: from_account_id and to_account_id must differ")
	}
	if t.Amount <= 0 {
		return fmt.Errorf("validation: amount must be greater than 0")
	}
	if t.Currency == "" {
		return fmt.Errorf("validation: currency is required")
	}
	return nil
}
