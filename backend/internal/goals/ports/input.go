package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/goals/domain"
)

// CreateGoalParams holds the parameters for creating a goal.
type CreateGoalParams struct {
	UserID       string
	RoleID       string
	ParentGoalID *string
	Title        string
	Description  string
	Weight       float64
	Deadline     *time.Time
}

// UpdateGoalParams holds the parameters for updating a goal.
// Pointer fields allow partial updates (nil means no change).
type UpdateGoalParams struct {
	Title        *string
	Description  *string
	Weight       *float64
	Status       *string
	Deadline     *time.Time
	ClearDeadline bool
}

// RoleGoalsFilter controls how goals are listed.
type RoleGoalsFilter struct {
	RoleID string
}

// GoalService defines the input port for the goals domain.
type GoalService interface {
	CreateGoal(ctx context.Context, params CreateGoalParams) (*domain.Goal, error)
	GetGoal(ctx context.Context, userID, id string) (*domain.Goal, error)
	ListGoals(ctx context.Context, userID string) ([]*domain.Goal, error)
	ListGoalsByRole(ctx context.Context, userID, roleID string) ([]*domain.Goal, error)
	UpdateGoal(ctx context.Context, userID, id string, params UpdateGoalParams) (*domain.Goal, error)
	DeleteGoal(ctx context.Context, userID, id string) error
}
