package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrGoalNotFound is returned when a goal cannot be found.
var ErrGoalNotFound = errors.New("goal not found")

// ValidStatuses contains the allowed goal status values.
var ValidStatuses = map[string]bool{
	"active":    true,
	"completed": true,
	"archived":  true,
}

// Goal represents a user goal linked to a role.
type Goal struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	RoleID       string     `json:"role_id"`
	ParentGoalID *string    `json:"parent_goal_id,omitempty"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Weight       float64    `json:"weight"`
	Status       string     `json:"status"`
	Deadline     *time.Time `json:"deadline,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Validate checks that the goal has all required fields and valid values.
func (g *Goal) Validate() error {
	if g.Title == "" {
		return fmt.Errorf("validation: title is required")
	}
	if g.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if g.RoleID == "" {
		return fmt.Errorf("validation: role_id is required")
	}
	if g.Weight < 0 || g.Weight > 10 {
		return fmt.Errorf("validation: weight must be between 0 and 10")
	}
	if g.Status != "" && !ValidStatuses[g.Status] {
		return fmt.Errorf("validation: status must be one of active, completed, archived")
	}
	return nil
}
