package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/balance/domain"
)

// BalanceRepository is the output port for balance data access.
type BalanceRepository interface {
	// FetchRoles returns all roles (with weights) for the given user.
	FetchRoles(ctx context.Context, userID string) ([]domain.RoleWeight, error)
	// FetchCompletedContributions returns every completed task contribution
	// since the given timestamp.
	FetchCompletedContributions(ctx context.Context, userID string, since time.Time) ([]domain.TaskContribution, error)
}
