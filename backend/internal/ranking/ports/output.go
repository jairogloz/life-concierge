package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/ranking/domain"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// RankedTaskRow holds a task with its associated role and goal weights fetched by the DB.
type RankedTaskRow struct {
	Task       *taskdomain.Task
	RoleWeight float64
	GoalWeight float64
}

// RankingRepository fetches tasks with their scoring inputs.
type RankingRepository interface {
	FetchScoringInputs(ctx context.Context, userID string, filter RankFilter) ([]domain.ScoreInput, error)
}
