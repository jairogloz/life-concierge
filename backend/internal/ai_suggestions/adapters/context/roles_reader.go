package context

import (
	"context"
	"fmt"

	rolespostgres "github.com/jairogloz/life-concierge/internal/roles/adapters/postgres"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
)

// RolesReader adapts the roles postgres repo to the RoleReader interface.
type RolesReader struct {
	repo *rolespostgres.RoleRepository
}

// NewRolesReader creates a new RolesReader.
func NewRolesReader(repo *rolespostgres.RoleRepository) *RolesReader {
	return &RolesReader{repo: repo}
}

func (r *RolesReader) List(ctx context.Context, userID string) ([]ports.RoleContext, error) {
	roles, err := r.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("roles reader: %w", err)
	}
	result := make([]ports.RoleContext, len(roles))
	for i, role := range roles {
		result[i] = ports.RoleContext{ID: role.ID, Name: role.Name}
	}
	return result, nil
}
