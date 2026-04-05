package application

import (
	"context"
	"fmt"

	"github.com/jairogloz/life-concierge/internal/ranking/domain"
	"github.com/jairogloz/life-concierge/internal/ranking/ports"
)

// RankingService implements ports.RankingService.
type RankingService struct {
	repo ports.RankingRepository
}

// NewRankingService creates a new RankingService.
func NewRankingService(repo ports.RankingRepository) *RankingService {
	return &RankingService{repo: repo}
}

func (s *RankingService) GetRankedTasks(ctx context.Context, userID string, filter ports.RankFilter) ([]*domain.ScoredTask, error) {
	inputs, err := s.repo.FetchScoringInputs(ctx, userID, filter)
	if err != nil {
		return nil, fmt.Errorf("ranking: fetch inputs: %w", err)
	}
	ranked := domain.RankTasks(inputs)
	if filter.Limit > 0 && len(ranked) > filter.Limit {
		ranked = ranked[:filter.Limit]
	}
	return ranked, nil
}
