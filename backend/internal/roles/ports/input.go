package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/roles/domain"
)

type CreateRoleParams struct {
	UserID string
	Name   string
	Weight float64
	Color  string
}

type UpdateRoleParams struct {
	Name   *string
	Weight *float64
	Color  *string
}

type RoleService interface {
	CreateRole(ctx context.Context, params CreateRoleParams) (*domain.Role, error)
	GetRole(ctx context.Context, userID, id string) (*domain.Role, error)
	ListRoles(ctx context.Context, userID string) ([]*domain.Role, error)
	UpdateRole(ctx context.Context, userID, id string, params UpdateRoleParams) (*domain.Role, error)
	DeleteRole(ctx context.Context, userID, id string) error
}
