package application

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/jairogloz/life-concierge/internal/balance/domain"
	"github.com/jairogloz/life-concierge/internal/balance/ports"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

const (
	// windowDays is the rolling window used for actual contribution.
	windowDays = 14
	// capacityFactor is the total "points" budget per 14-day window.
	// Each role's expected share = (role_weight / total_weight) * capacityFactor.
	capacityFactor = 50.0
)

// BalanceService implements ports.BalanceService.
type BalanceService struct {
	repo ports.BalanceRepository
}

// NewBalanceService creates a new BalanceService backed by the given repository.
func NewBalanceService(repo ports.BalanceRepository) *BalanceService {
	return &BalanceService{repo: repo}
}

// GetRoleBalanceSummary computes the life balance score for each of the user's
// roles using a rolling 14-day window of completed tasks.
func (s *BalanceService) GetRoleBalanceSummary(ctx context.Context, userID string) ([]domain.RoleBalanceScore, error) {
	since := time.Now().UTC().Add(-time.Duration(windowDays) * 24 * time.Hour)

	roles, err := s.repo.FetchRoles(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("balance: fetch roles: %w", err)
	}
	if len(roles) == 0 {
		return []domain.RoleBalanceScore{}, nil
	}

	contributions, err := s.repo.FetchCompletedContributions(ctx, userID, since)
	if err != nil {
		return nil, fmt.Errorf("balance: fetch contributions: %w", err)
	}

	// Sum all role weights to normalise expected shares.
	totalWeight := 0.0
	for _, r := range roles {
		totalWeight += r.Weight
	}
	if totalWeight <= 0 {
		totalWeight = 1.0
	}

	// Compute actual contribution per role.
	actualByRole := make(map[string]float64, len(roles))
	for _, c := range contributions {
		mult := taskdomain.TaskTypeMultiplier[taskdomain.TaskType(c.TaskType)]
		if mult <= 0 {
			mult = 1.0
		}
		actualByRole[c.RoleID] += c.RoleWeight * c.GoalWeight * float64(c.Impact) * mult
	}

	// Build result slice.
	result := make([]domain.RoleBalanceScore, 0, len(roles))
	for _, r := range roles {
		expected := (r.Weight / totalWeight) * capacityFactor
		if expected <= 0 {
			expected = 1.0
		}
		actual := actualByRole[r.ID]
		balanceScore := actual / expected
		if balanceScore > 1.0 {
			balanceScore = 1.0
		}

		result = append(result, domain.RoleBalanceScore{
			RoleID:       r.ID,
			RoleName:     r.Name,
			RoleColor:    r.Color,
			Actual:       math.Round(actual*100) / 100,
			Expected:     math.Round(expected*100) / 100,
			BalanceScore: math.Round(balanceScore*1000) / 1000,
			DisplayPct:   math.Round(balanceScore*1000) / 10,
		})
	}

	// Sort ascending so the most-neglected role is first.
	sort.Slice(result, func(i, j int) bool {
		return result[i].BalanceScore < result[j].BalanceScore
	})

	return result, nil
}

// GetRoleBalanceScores returns a map of roleID to balance score (0-1).
func (s *BalanceService) GetRoleBalanceScores(ctx context.Context, userID string) (map[string]float64, error) {
	summary, err := s.GetRoleBalanceSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	scores := make(map[string]float64, len(summary))
	for _, r := range summary {
		scores[r.RoleID] = r.BalanceScore
	}
	return scores, nil
}

// Ensure BalanceService satisfies the port interface at compile time.
var _ ports.BalanceService = (*BalanceService)(nil)
