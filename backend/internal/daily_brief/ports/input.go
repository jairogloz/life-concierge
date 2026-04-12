package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/daily_brief/domain"
)

// DailyBriefService is the primary port for the daily_brief domain.
type DailyBriefService interface {
	GetDailyBrief(ctx context.Context, userID string) (*domain.DailyBrief, error)
}
