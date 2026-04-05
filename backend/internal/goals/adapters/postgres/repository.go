package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/goals/domain"
	"github.com/jairogloz/life-concierge/internal/goals/ports"
)

const goalColumns = `id, user_id, role_id, parent_goal_id, title, description, weight, status, deadline, created_at, updated_at`

// GoalRepository is a PostgreSQL implementation of ports.GoalRepository.
type GoalRepository struct {
	db *pgxpool.Pool
}

// NewGoalRepository creates a new PostgreSQL-backed GoalRepository.
func NewGoalRepository(db *pgxpool.Pool) *GoalRepository {
	return &GoalRepository{db: db}
}

func (r *GoalRepository) Create(ctx context.Context, goal *domain.Goal) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO goals (`+goalColumns+`)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		goal.ID, goal.UserID, goal.RoleID, goal.ParentGoalID,
		goal.Title, goal.Description, goal.Weight, goal.Status,
		goal.Deadline, goal.CreatedAt, goal.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("goals.Create: %w", err)
	}
	return nil
}

func (r *GoalRepository) GetByID(ctx context.Context, userID, id string) (*domain.Goal, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+goalColumns+` FROM goals WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return scanGoal(row)
}

func (r *GoalRepository) List(ctx context.Context, userID string) ([]*domain.Goal, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+goalColumns+` FROM goals WHERE user_id=$1 ORDER BY title`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("goals.List: %w", err)
	}
	return collectGoals(rows)
}

func (r *GoalRepository) ListByRole(ctx context.Context, userID, roleID string) ([]*domain.Goal, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+goalColumns+` FROM goals WHERE user_id=$1 AND role_id=$2 ORDER BY title`,
		userID, roleID,
	)
	if err != nil {
		return nil, fmt.Errorf("goals.ListByRole: %w", err)
	}
	return collectGoals(rows)
}

func (r *GoalRepository) Update(ctx context.Context, goal *domain.Goal) error {
	_, err := r.db.Exec(ctx,
		`UPDATE goals
		    SET title=$1, description=$2, weight=$3, status=$4, deadline=$5, updated_at=$6
		  WHERE id=$7 AND user_id=$8`,
		goal.Title, goal.Description, goal.Weight, goal.Status,
		goal.Deadline, goal.UpdatedAt, goal.ID, goal.UserID,
	)
	if err != nil {
		return fmt.Errorf("goals.Update: %w", err)
	}
	return nil
}

func (r *GoalRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM goals WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return fmt.Errorf("goals.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrGoalNotFound
	}
	return nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanGoal(row scanner) (*domain.Goal, error) {
	g := &domain.Goal{}
	err := row.Scan(
		&g.ID, &g.UserID, &g.RoleID, &g.ParentGoalID,
		&g.Title, &g.Description, &g.Weight, &g.Status,
		&g.Deadline, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrGoalNotFound
		}
		return nil, fmt.Errorf("goals.scan: %w", err)
	}
	return g, nil
}

func collectGoals(rows pgx.Rows) ([]*domain.Goal, error) {
	defer rows.Close()
	var goals []*domain.Goal
	for rows.Next() {
		g, err := scanGoal(rows)
		if err != nil {
			return nil, err
		}
		goals = append(goals, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("goals.collect rows: %w", err)
	}
	return goals, nil
}

// Ensure GoalRepository satisfies the port interface at compile time.
var _ ports.GoalRepository = (*GoalRepository)(nil)
