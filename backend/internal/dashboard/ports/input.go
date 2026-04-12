package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/dashboard/domain"
)

// DashboardService is the input port for the today dashboard.
type DashboardService interface {
	GetTodaySummary(ctx context.Context, userID string) (*domain.TodaySummary, error)
}
