package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/balance/domain"
	"github.com/jairogloz/life-concierge/internal/balance/ports"
)

// BalanceRepository is a PostgreSQL implementation of ports.BalanceRepository.
type BalanceRepository struct {
	db *pgxpool.Pool
}

// NewBalanceRepository creates a new BalanceRepository.
func NewBalanceRepository(db *pgxpool.Pool) *BalanceRepository {
	return &BalanceRepository{db: db}
}

// FetchRoles returns all roles for the user ordered by weight descending.
func (r *BalanceRepository) FetchRoles(ctx context.Context, userID string) ([]domain.RoleWeight, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, name, weight, color FROM roles WHERE user_id = $1 ORDER BY weight DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("balance.FetchRoles: %w", err)
	}
	defer rows.Close()

	var roles []domain.RoleWeight
	for rows.Next() {
		var rw domain.RoleWeight
		if err := rows.Scan(&rw.ID, &rw.Name, &rw.Weight, &rw.Color); err != nil {
			return nil, fmt.Errorf("balance.FetchRoles scan: %w", err)
		}
		roles = append(roles, rw)
	}
	return roles, rows.Err()
}

// FetchCompletedContributions returns one row per completed task contribution
// within the given time window.
func (r *BalanceRepository) FetchCompletedContributions(ctx context.Context, userID string, since time.Time) ([]domain.TaskContribution, error) {
	const query = `
		SELECT
		    t.primary_role_id,
		    r.weight            AS role_weight,
		    COALESCE(g.weight, 1.0) AS goal_weight,
		    t.impact,
		    t.task_type::text   AS task_type
		FROM tasks t
		JOIN  roles r ON r.id = t.primary_role_id
		LEFT JOIN goals g ON g.id = t.goal_id
		WHERE t.user_id = $1
		  AND t.task_type = 'one_time'
		  AND t.status   = 'done'
		  AND t.updated_at >= $2

		UNION ALL

		SELECT
		    t.primary_role_id,
		    r.weight            AS role_weight,
		    COALESCE(g.weight, 1.0) AS goal_weight,
		    t.impact,
		    t.task_type::text   AS task_type
		FROM tasks t
		JOIN  roles r ON r.id = t.primary_role_id
		LEFT JOIN goals g ON g.id = t.goal_id,
		     jsonb_array_elements(t.completion_log) AS entry
		WHERE t.user_id = $1
		  AND t.task_type = 'daily'
		  AND (entry->>'done')::boolean  = true
		  AND (entry->>'date')::date    >= $2::date
	`
	rows, err := r.db.Query(ctx, query, userID, since)
	if err != nil {
		return nil, fmt.Errorf("balance.FetchCompletedContributions: %w", err)
	}
	defer rows.Close()

	var contribs []domain.TaskContribution
	for rows.Next() {
		var c domain.TaskContribution
		if err := rows.Scan(&c.RoleID, &c.RoleWeight, &c.GoalWeight, &c.Impact, &c.TaskType); err != nil {
			return nil, fmt.Errorf("balance.FetchCompletedContributions scan: %w", err)
		}
		contribs = append(contribs, c)
	}
	return contribs, rows.Err()
}

// Ensure BalanceRepository satisfies the port interface at compile time.
var _ ports.BalanceRepository = (*BalanceRepository)(nil)
