package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrRoleNotFound is returned when a role cannot be found.
var ErrRoleNotFound = errors.New("role not found")

// Role represents a life role (e.g. "Professional", "Parent", "Health").
type Role struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Weight    float64   `json:"weight"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Validate checks that the role has all required fields and valid values.
func (r *Role) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("validation: name is required")
	}
	if r.Weight < 0 || r.Weight > 10 {
		return fmt.Errorf("validation: weight must be between 0 and 10")
	}
	if r.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	return nil
}
