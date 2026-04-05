package domain

import (
	"math"
	"sort"
	"time"

	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// ScoredTask pairs a task with its computed priority score and contributing weights.
type ScoredTask struct {
	*taskdomain.Task
	Score      float64 `json:"score"`
	RoleWeight float64 `json:"role_weight"`
	GoalWeight float64 `json:"goal_weight"`
}

// ScoreInput holds everything needed to compute a task score.
type ScoreInput struct {
	Task       *taskdomain.Task
	RoleWeight float64
	GoalWeight float64
	Now        time.Time
}

// ComputeScore computes the priority score for a task.
// Formula: role_weight x goal_weight x urgency x commitment_multiplier x deadline_pressure
func ComputeScore(in ScoreInput) float64 {
	roleW := in.RoleWeight
	if roleW <= 0 {
		roleW = 1.0
	}
	goalW := in.GoalWeight
	if goalW <= 0 {
		goalW = 1.0
	}
	urgency := in.Task.Urgency
	commitMult, ok := taskdomain.CommitmentMultiplier[in.Task.CommitmentType]
	if !ok || commitMult <= 0 {
		commitMult = 1.0
	}
	deadlinePressure := computeDeadlinePressure(in.Task.Deadline, in.Now)
	return roleW * goalW * urgency * commitMult * deadlinePressure
}

// computeDeadlinePressure returns a multiplier [1.0, 10.0] based on time left.
// Exponential decay: pressure rises as deadline approaches. Overdue tasks score 10.0.
func computeDeadlinePressure(deadline *time.Time, now time.Time) float64 {
	if deadline == nil {
		return 1.0
	}
	daysLeft := deadline.Sub(now).Hours() / 24.0
	if daysLeft <= 0 {
		return 10.0 // overdue — max pressure
	}
	// pressure = e^(-daysLeft/14) * 10, clamped to [1.0, 10.0]
	pressure := math.Exp(-daysLeft/14.0) * 10.0
	if pressure < 1.0 {
		pressure = 1.0
	}
	return pressure
}

// RankTasks scores and sorts tasks by descending priority score.
func RankTasks(inputs []ScoreInput) []*ScoredTask {
	result := make([]*ScoredTask, 0, len(inputs))
	for _, in := range inputs {
		result = append(result, &ScoredTask{
			Task:       in.Task,
			Score:      ComputeScore(in),
			RoleWeight: in.RoleWeight,
			GoalWeight: in.GoalWeight,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Score > result[j].Score
	})
	return result
}
