package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrAccountNotFound is returned when an account cannot be found.
var ErrAccountNotFound = errors.New("account not found")

// AccountType represents the kind of financial account.
type AccountType string

const (
	AccountTypeChecking   AccountType = "checking"
	AccountTypeSavings    AccountType = "savings"
	AccountTypeCash       AccountType = "cash"
	AccountTypeInvestment AccountType = "investment"
	AccountTypeCreditCard AccountType = "credit_card"
	AccountTypeOther      AccountType = "other"
)

var validAccountTypes = map[AccountType]bool{
	AccountTypeChecking:   true,
	AccountTypeSavings:    true,
	AccountTypeCash:       true,
	AccountTypeInvestment: true,
	AccountTypeCreditCard: true,
	AccountTypeOther:      true,
}

// Account represents a user's financial account.
type Account struct {
	ID        string      `json:"id"`
	UserID    string      `json:"user_id"`
	Name      string      `json:"name"`
	Type      AccountType `json:"type"`
	Currency  string      `json:"currency"`
	Balance   float64     `json:"balance"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// Validate checks all required fields and valid values.
func (a *Account) Validate() error {
	if a.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if a.Name == "" {
		return fmt.Errorf("validation: name is required")
	}
	if !validAccountTypes[a.Type] {
		return fmt.Errorf("validation: invalid account type %q", a.Type)
	}
	if a.Currency == "" {
		return fmt.Errorf("validation: currency is required")
	}
	return nil
}
