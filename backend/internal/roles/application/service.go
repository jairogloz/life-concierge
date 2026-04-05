package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/roles/domain"
	"github.com/jairogloz/life-concierge/internal/roles/ports"
)

// RoleService implements ports.RoleService.
type RoleService struct {
	repo ports.RoleRepository
}

// NewRoleService creates a new RoleService.
func NewRoleService(repo ports.RoleRepository) *RoleService {
	return &RoleService{repo: repo}
}

func (s *RoleService) CreateRole(ctx context.Context, params ports.CreateRoleParams) (*domain.Role, error) {
	role := &domain.Role{
		ID:        uuid.New().String(),
		UserID:    params.UserID,
		Name:      params.Name,
		Weight:    params.Weight,
		Color:     params.Color,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := role.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, role); err != nil {
		return nil, fmt.Errorf("create role: %w", err)
	}
	return role, nil
}

func (s *RoleService) GetRole(ctx context.Context, userID, id string) (*domain.Role, error) {
	role, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	return role, nil
}

func (s *RoleService) ListRoles(ctx context.Context, userID string) ([]*domain.Role, error) {
	roles, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	return roles, nil
}

func (s *RoleService) UpdateRole(ctx context.Context, userID, id string, params ports.UpdateRoleParams) (*domain.Role, error) {
	role, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if params.Name != nil {
		role.Name = *params.Name
	}
	if params.Weight != nil {
		role.Weight = *params.Weight
	}
	if params.Color != nil {
		role.Color = *params.Color
	}
	role.UpdatedAt = time.Now().UTC()
	if err := role.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Update(ctx, role); err != nil {
		return nil, fmt.Errorf("update role: %w", err)
	}
	return role, nil
}

func (s *RoleService) DeleteRole(ctx context.Context, userID, id string) error {
	if err := s.repo.Delete(ctx, userID, id); err != nil {
		return err
	}
	return nil
}
