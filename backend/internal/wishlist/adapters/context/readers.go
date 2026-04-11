package context

import (
	"context"
	"fmt"

	financepostgres "github.com/jairogloz/life-concierge/internal/finance/adapters/postgres"
	goalspostgres "github.com/jairogloz/life-concierge/internal/goals/adapters/postgres"
	rolespostgres "github.com/jairogloz/life-concierge/internal/roles/adapters/postgres"
)

// ── Roles ─────────────────────────────────────────────────────────────────

// RolesReader adapts the roles repository to the wishlist RoleReader port.
type RolesReader struct {
	repo *rolespostgres.RoleRepository
}

// NewRolesReader creates a new RolesReader.
func NewRolesReader(repo *rolespostgres.RoleRepository) *RolesReader {
	return &RolesReader{repo: repo}
}

// GetRole returns the name and weight of a role by ID.
func (r *RolesReader) GetRole(ctx context.Context, userID, roleID string) (string, float64, error) {
	role, err := r.repo.GetByID(ctx, userID, roleID)
	if err != nil {
		return "", 0, fmt.Errorf("roles reader: %w", err)
	}
	return role.Name, role.Weight, nil
}

// ── Goals ─────────────────────────────────────────────────────────────────

// GoalsReader adapts the goals repository to the wishlist GoalReader port.
type GoalsReader struct {
	repo *goalspostgres.GoalRepository
}

// NewGoalsReader creates a new GoalsReader.
func NewGoalsReader(repo *goalspostgres.GoalRepository) *GoalsReader {
	return &GoalsReader{repo: repo}
}

// GetGoal returns the title and progress of a goal by ID.
// Progress defaults to 0 as goals do not yet carry a numeric progress field.
func (r *GoalsReader) GetGoal(ctx context.Context, userID, goalID string) (string, float64, error) {
	goal, err := r.repo.GetByID(ctx, userID, goalID)
	if err != nil {
		return "", 0, fmt.Errorf("goals reader: %w", err)
	}
	return goal.Title, 0, nil
}

// ── Finance ───────────────────────────────────────────────────────────────

// FinanceReader adapts the finance repository to the wishlist FinanceSummaryReader port.
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
