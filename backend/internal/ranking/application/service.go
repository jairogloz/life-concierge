package application

import (
	"context"
	"fmt"

	balanceports "github.com/jairogloz/life-concierge/internal/balance/ports"
	gamificationports "github.com/jairogloz/life-concierge/internal/gamification/ports"
	"github.com/jairogloz/life-concierge/internal/ranking/domain"
	"github.com/jairogloz/life-concierge/internal/ranking/ports"
)

// RankingService implements ports.RankingService.
type RankingService struct {
	repo         ports.RankingRepository
	balance      balanceports.BalanceService           // optional; nil disables role-neglect boost
	gamification gamificationports.GamificationService // optional; nil disables consistency bonus
}

// SetGamification wires the gamification service for consistency bonus inputs.
func (s *RankingService) SetGamification(gm gamificationports.GamificationService) {
	s.gamification = gm
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

	// Inject consistency bonus from streaks (small capped multiplier).
	if s.gamification != nil {
		if profile, err := s.gamification.GetProfile(ctx, userID); err == nil && profile != nil {
			roleStreaks := map[string]int{}
			for _, rs := range profile.RoleStreaks {
				if rs != nil && rs.RoleID != nil {
					roleStreaks[*rs.RoleID] = rs.CurrentStreak
				}
			}
			for i := range inputs {
				globalDays := profile.GlobalCurrentStreak
				roleDays := roleStreaks[inputs[i].Task.PrimaryRoleID]
				inputs[i].ConsistencyBonus = computeConsistencyBonus(globalDays, roleDays)
			}
		}
		// Non-fatal: ranking continues without consistency bonus on error.
	}

	ranked := domain.RankTasks(inputs)
	if filter.Limit > 0 && len(ranked) > filter.Limit {
		ranked = ranked[:filter.Limit]
	}
	return ranked, nil
}

func computeConsistencyBonus(globalDays, roleDays int) float64 {
	if globalDays < 0 {
		globalDays = 0
	}
	if roleDays < 0 {
		roleDays = 0
	}
	bonus := 1.0 + (0.005 * float64(globalDays)) + (0.01 * float64(roleDays))
	if bonus > 1.2 {
		return 1.2
	}
	if bonus < 1.0 {
		return 1.0
	}
	return bonus
}
