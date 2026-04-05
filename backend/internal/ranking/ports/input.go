package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/ranking/domain"
)

// RankFilter controls the ranked list query.
type RankFilter struct {
	Context string // filter by context tag
	Limit   int    // max results (0 = no limit)
	RoleID  string // filter to a specific role
}

// RankingService defines the input port for the ranking engine.
type RankingService interface {
	GetRankedTasks(ctx context.Context, userID string, filter RankFilter) ([]*domain.ScoredTask, error)
}
