package application

import (
	"context"
	"fmt"

	balanceports "github.com/jairogloz/life-concierge/internal/balance/ports"
	"github.com/jairogloz/life-concierge/internal/ranking/domain"
	"github.com/jairogloz/life-concierge/internal/ranking/ports"
)

// RankingService implements ports.RankingService.
type RankingService struct {
	repo    ports.RankingRepository
	balance balanceports.BalanceService // optional; nil disables role-neglect boost
}

// NewRankingService creates a new RankingService.
// balance may be nil — in that case the role-neglect multiplier defaults to its
// maximum value (1.8) because no balance scores are available.
func NewRankingService(repo ports.RankingRepository, balance balanceports.BalanceService) *RankingService {
	return &RankingService{repo: repo, balance: balance}
}

func (s *RankingService) GetRankedTasks(ctx context.Context, userID string, filter ports.RankFilter) ([]*domain.ScoredTask, error) {
	inputs, err := s.repo.FetchScoringInputs(ctx, userID, filter)
	if err != nil {
		return nil, fmt.Errorf("ranking: fetch inputs: %w", err)
	}

	// Fetch balance scores and inject into every ScoreInput so the scorer
	// can apply role-neglect multipliers.
	if s.balance != nil {
		roleScores, err := s.balance.GetRoleBalanceScores(ctx, userID)
		if err == nil && len(roleScores) > 0 {
			for i := range inputs {
				if score, ok := roleScores[inputs[i].Task.PrimaryRoleID]; ok {
					inputs[i].RoleBalanceScore = score
				}
			}
		}
		// Non-fatal: ranking continues without balance scores on error.
	}

	ranked := domain.RankTasks(inputs)
	if filter.Limit > 0 && len(ranked) > filter.Limit {
		ranked = ranked[:filter.Limit]
	}
	return ranked, nil
}
