package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/balance/domain"
)

// BalanceService is the input port for the life balance scoring system.
type BalanceService interface {
	// GetRoleBalanceSummary returns the full balance breakdown per role,
	// sorted ascending by balance score (most neglected first).
	GetRoleBalanceSummary(ctx context.Context, userID string) ([]domain.RoleBalanceScore, error)
	// GetRoleBalanceScores returns a map of roleID to balance score (0-1) for
	// efficient injection into the ranking engine.
	GetRoleBalanceScores(ctx context.Context, userID string) (map[string]float64, error)
}
