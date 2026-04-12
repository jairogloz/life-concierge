package application

import (
	"context"
	"fmt"

	balanceports "github.com/jairogloz/life-concierge/internal/balance/ports"
	dashboarddomain "github.com/jairogloz/life-concierge/internal/dashboard/domain"
	dashboardports "github.com/jairogloz/life-concierge/internal/dashboard/ports"
	rankingports "github.com/jairogloz/life-concierge/internal/ranking/ports"
)

// DashboardService implements ports.DashboardService.
type DashboardService struct {
	balance balanceports.BalanceService
	ranking rankingports.RankingService
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(balance balanceports.BalanceService, ranking rankingports.RankingService) *DashboardService {
	return &DashboardService{balance: balance, ranking: ranking}
}

// GetTodaySummary returns the role balance summary and the top 5 ranked tasks.
func (s *DashboardService) GetTodaySummary(ctx context.Context, userID string) (*dashboarddomain.TodaySummary, error) {
	balanceSummary, err := s.balance.GetRoleBalanceSummary(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("dashboard: balance summary: %w", err)
	}

	tasks, err := s.ranking.GetRankedTasks(ctx, userID, rankingports.RankFilter{Limit: 5})
	if err != nil {
		return nil, fmt.Errorf("dashboard: ranked tasks: %w", err)
	}

	return &dashboarddomain.TodaySummary{
		RoleBalanceSummary: balanceSummary,
		RecommendedTasks:   tasks,
	}, nil
}

// Ensure DashboardService satisfies the port interface at compile time.
var _ dashboardports.DashboardService = (*DashboardService)(nil)
