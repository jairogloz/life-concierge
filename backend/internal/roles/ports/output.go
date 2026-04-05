package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/roles/domain"
)

// RoleRepository defines the driven port (persistence interface) for the roles domain.
type RoleRepository interface {
	Create(ctx context.Context, role *domain.Role) error
	GetByID(ctx context.Context, userID, id string) (*domain.Role, error)
	List(ctx context.Context, userID string) ([]*domain.Role, error)
	Update(ctx context.Context, role *domain.Role) error
	Delete(ctx context.Context, userID, id string) error
}
