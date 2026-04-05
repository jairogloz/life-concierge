package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/roles/domain"
	"github.com/jairogloz/life-concierge/internal/roles/ports"
)

// RoleRepository is a PostgreSQL implementation of ports.RoleRepository.
type RoleRepository struct {
	db *pgxpool.Pool
}

// NewRoleRepository creates a new PostgreSQL-backed RoleRepository.
func NewRoleRepository(db *pgxpool.Pool) *RoleRepository {
	return &RoleRepository{db: db}
}

func (r *RoleRepository) Create(ctx context.Context, role *domain.Role) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO roles (id, user_id, name, weight, color, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		role.ID, role.UserID, role.Name, role.Weight, role.Color,
		role.CreatedAt, role.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("roles.Create: %w", err)
	}
	return nil
}

func (r *RoleRepository) GetByID(ctx context.Context, userID, id string) (*domain.Role, error) {
	row := r.db.QueryRow(ctx,
		`SELECT id, user_id, name, weight, color, created_at, updated_at
		   FROM roles
		  WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	role := &domain.Role{}
	err := row.Scan(
		&role.ID, &role.UserID, &role.Name, &role.Weight, &role.Color,
		&role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrRoleNotFound
		}
		return nil, fmt.Errorf("roles.GetByID: %w", err)
	}
	return role, nil
}

func (r *RoleRepository) List(ctx context.Context, userID string) ([]*domain.Role, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, name, weight, color, created_at, updated_at
		   FROM roles
		  WHERE user_id = $1
		  ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("roles.List: %w", err)
	}
	defer rows.Close()

	var roles []*domain.Role
	for rows.Next() {
		role := &domain.Role{}
		if err := rows.Scan(
			&role.ID, &role.UserID, &role.Name, &role.Weight, &role.Color,
			&role.CreatedAt, &role.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("roles.List scan: %w", err)
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("roles.List rows: %w", err)
	}
	return roles, nil
}

func (r *RoleRepository) Update(ctx context.Context, role *domain.Role) error {
	_, err := r.db.Exec(ctx,
		`UPDATE roles
		    SET name = $1, weight = $2, color = $3, updated_at = $4
		  WHERE id = $5 AND user_id = $6`,
		role.Name, role.Weight, role.Color, role.UpdatedAt, role.ID, role.UserID,
	)
	if err != nil {
		return fmt.Errorf("roles.Update: %w", err)
	}
	return nil
}

func (r *RoleRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM roles WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("roles.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrRoleNotFound
	}
	return nil
}

// Ensure RoleRepository satisfies the port interface at compile time.
var _ ports.RoleRepository = (*RoleRepository)(nil)
