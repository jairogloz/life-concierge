package ports

import (
	"context"
	"time"

	goalsdomain "github.com/jairogloz/life-concierge/internal/goals/domain"
	rolesdomain "github.com/jairogloz/life-concierge/internal/roles/domain"
	timelinedomain "github.com/jairogloz/life-concierge/internal/timeline/domain"

	"github.com/jairogloz/life-concierge/internal/daily_brief/domain"
)

// BriefInput bundles all context data fed to the strategy agent.
type BriefInput struct {
	Events  []*timelinedomain.TimelineEvent
	Goals   []*goalsdomain.Goal
	Roles   []*rolesdomain.Role
	Balance float64
}

// TimelineReader reads recent timeline events for the daily brief.
type TimelineReader interface {
	ListRecentEvents(ctx context.Context, userID string, since time.Time) ([]*timelinedomain.TimelineEvent, error)
}

// GoalsReader lists all active goals for the user.
type GoalsReader interface {
	ListGoals(ctx context.Context, userID string) ([]*goalsdomain.Goal, error)
}

// RolesReader lists all roles for the user.
type RolesReader interface {
	ListRoles(ctx context.Context, userID string) ([]*rolesdomain.Role, error)
}

// FinanceReader returns the total account balance for the user.
type FinanceReader interface {
	GetTotalBalance(ctx context.Context, userID string) (float64, error)
}

// StrategyAgent generates a daily brief from context data.
type StrategyAgent interface {
	GenerateBrief(ctx context.Context, input BriefInput) (*domain.DailyBrief, error)
}
