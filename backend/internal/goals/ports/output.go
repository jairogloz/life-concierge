package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/goals/domain"
)

// GoalRepository defines the driven port (persistence interface) for the goals domain.
type GoalRepository interface {
	Create(ctx context.Context, goal *domain.Goal) error
	GetByID(ctx context.Context, userID, id string) (*domain.Goal, error)
	List(ctx context.Context, userID string) ([]*domain.Goal, error)
	ListByRole(ctx context.Context, userID, roleID string) ([]*domain.Goal, error)
	Update(ctx context.Context, goal *domain.Goal) error
	Delete(ctx context.Context, userID, id string) error
}
