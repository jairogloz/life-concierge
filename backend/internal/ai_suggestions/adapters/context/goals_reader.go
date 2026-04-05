package context

import (
	"context"
	"fmt"

	goalspostgres "github.com/jairogloz/life-concierge/internal/goals/adapters/postgres"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
)

// GoalsReader adapts the goals postgres repo to the GoalReader interface.
type GoalsReader struct {
	repo *goalspostgres.GoalRepository
}

// NewGoalsReader creates a new GoalsReader.
func NewGoalsReader(repo *goalspostgres.GoalRepository) *GoalsReader {
	return &GoalsReader{repo: repo}
}

func (r *GoalsReader) List(ctx context.Context, userID string) ([]ports.GoalContext, error) {
	goals, err := r.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("goals reader: %w", err)
	}
	result := make([]ports.GoalContext, len(goals))
	for i, g := range goals {
		result[i] = ports.GoalContext{ID: g.ID, Title: g.Title, RoleID: g.RoleID}
	}
	return result, nil
}
