package context

import (
	"context"
	"fmt"
	"time"

	financepostgres "github.com/jairogloz/life-concierge/internal/finance/adapters/postgres"
	goalspostgres "github.com/jairogloz/life-concierge/internal/goals/adapters/postgres"
	goalsdomain "github.com/jairogloz/life-concierge/internal/goals/domain"
	rolesdomain "github.com/jairogloz/life-concierge/internal/roles/domain"
	rolespostgres "github.com/jairogloz/life-concierge/internal/roles/adapters/postgres"
	timelinepostgres "github.com/jairogloz/life-concierge/internal/timeline/adapters/postgres"
	timelinedomain "github.com/jairogloz/life-concierge/internal/timeline/domain"
)

// ── Timeline ──────────────────────────────────────────────────────────────────

// TimelineReader wraps the timeline postgres repo for the daily_brief port.
type TimelineReader struct {
	repo *timelinepostgres.TimelineRepository
}

// NewTimelineReader creates a new TimelineReader.
func NewTimelineReader(repo *timelinepostgres.TimelineRepository) *TimelineReader {
	return &TimelineReader{repo: repo}
}

// ListRecentEvents returns timeline events since the given time.
func (r *TimelineReader) ListRecentEvents(ctx context.Context, userID string, since time.Time) ([]*timelinedomain.TimelineEvent, error) {
	events, err := r.repo.ListSince(ctx, userID, since)
	if err != nil {
		return nil, fmt.Errorf("timeline reader: %w", err)
	}
	return events, nil
}

// ── Goals ─────────────────────────────────────────────────────────────────────

// GoalsReader wraps the goals postgres repo for the daily_brief port.
type GoalsReader struct {
	repo *goalspostgres.GoalRepository
}

// NewGoalsReader creates a new GoalsReader.
func NewGoalsReader(repo *goalspostgres.GoalRepository) *GoalsReader {
	return &GoalsReader{repo: repo}
}

// ListGoals returns all goals for the user.
func (r *GoalsReader) ListGoals(ctx context.Context, userID string) ([]*goalsdomain.Goal, error) {
	goals, err := r.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("goals reader: %w", err)
	}
	return goals, nil
}

// ── Roles ─────────────────────────────────────────────────────────────────────

// RolesReader wraps the roles postgres repo for the daily_brief port.
type RolesReader struct {
	repo *rolespostgres.RoleRepository
}

// NewRolesReader creates a new RolesReader.
func NewRolesReader(repo *rolespostgres.RoleRepository) *RolesReader {
	return &RolesReader{repo: repo}
}

// ListRoles returns all roles for the user.
func (r *RolesReader) ListRoles(ctx context.Context, userID string) ([]*rolesdomain.Role, error) {
	roles, err := r.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("roles reader: %w", err)
	}
	return roles, nil
}

// ── Finance ───────────────────────────────────────────────────────────────────

// FinanceReader wraps the finance postgres repo for the daily_brief port.
type FinanceReader struct {
	repo *financepostgres.FinanceRepository
}

// NewFinanceReader creates a new FinanceReader.
func NewFinanceReader(repo *financepostgres.FinanceRepository) *FinanceReader {
	return &FinanceReader{repo: repo}
}

// GetTotalBalance returns the sum of all account balances for the user.
func (r *FinanceReader) GetTotalBalance(ctx context.Context, userID string) (float64, error) {
	balance, err := r.repo.GetBalanceSum(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("finance reader: %w", err)
	}
	return balance, nil
}
