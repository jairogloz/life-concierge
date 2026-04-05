package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// TaskRepository defines the driven port (persistence interface) for the tasks domain.
type TaskRepository interface {
	Create(ctx context.Context, task *domain.Task) error
	GetByID(ctx context.Context, userID, id string) (*domain.Task, error)
	List(ctx context.Context, userID string, filter TaskFilter) ([]*domain.Task, error)
	Update(ctx context.Context, task *domain.Task) error
	Delete(ctx context.Context, userID, id string) error
	SetSecondaryRoles(ctx context.Context, taskID string, roleIDs []string) error
}
