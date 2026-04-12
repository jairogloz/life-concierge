package domain

import (
	"fmt"
	"math"
	"sort"
	"time"

	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// ScoredTask pairs a task with its Execution Priority Score and score factors.
type ScoredTask struct {
	Task             *taskdomain.Task `json:"task"`
	Score            float64          `json:"score"`
	RoleWeight       float64          `json:"role_weight"`
	GoalWeight       float64          `json:"goal_weight"`
	RoleNeglectMult  float64          `json:"role_neglect_mult"`
	Explanations     []string         `json:"explanations"`
}

// ScoreInput holds everything needed to compute a task score.
type ScoreInput struct {
	Task              *taskdomain.Task
	RoleWeight        float64
	GoalWeight        float64
	// RoleBalanceScore is the life balance score (0–1) for the task's primary role.
	// 0 means the role is fully neglected; 1 means it is fully served.
	// Leave as 0 to apply maximum neglect boost.
	RoleBalanceScore  float64
	Now               time.Time
}

// ComputeScore computes the Execution Priority Score (EPS) for a task.
//
// Formula:
//
//	roi = (roleW × goalW × impact × taskTypeMult) / sqrt(max(15, estMins))
//	role_neglect_mult = 1 + 0.8 × max(0, 1 − role_balance_score)
//	EPS = roi × role_neglect_mult × deadline_pressure × scheduled_mult
//
// The function also returns a slice of human-readable explanation strings.
func ComputeScore(in ScoreInput) (float64, []string) {
	var explanations []string

	roleW := in.RoleWeight
	if roleW <= 0 {
		roleW = 1.0
	}
	goalW := in.GoalWeight
	if goalW <= 0 {
		goalW = 1.0
	}

	estMins := 30.0
	if in.Task.EstimatedMinutes != nil && *in.Task.EstimatedMinutes > 0 {
		estMins = float64(*in.Task.EstimatedMinutes)
	}
	effortCost := math.Sqrt(math.Max(15, estMins))

	taskMult, ok := taskdomain.TaskTypeMultiplier[in.Task.TaskType]
	if !ok || taskMult <= 0 {
		taskMult = 1.0
	}

	taskValue := roleW * goalW * float64(in.Task.Impact) * taskMult
	roi := taskValue / effortCost
	explanations = append(explanations, fmt.Sprintf("ROI %.2f (impact=%d, %.0fmin)", roi, in.Task.Impact, estMins))

	// Role neglect multiplier: tasks in under-served roles get a boost.
	balanceScore := in.RoleBalanceScore
	neglectMult := 1.0 + 0.8*math.Max(0, 1-balanceScore)
	if neglectMult > 1.0 {
		explanations = append(explanations, fmt.Sprintf("Role neglect ×%.2f (balance=%.0f%%)", neglectMult, balanceScore*100))
	}

	dp := computeDeadlinePressure(in.Task.Deadline, in.Task.SoftDeadline, in.Now)
	if dp > 1.0 {
		explanations = append(explanations, fmt.Sprintf("Deadline pressure ×%.2f", dp))
	}

	scheduledMult := computeScheduledMult(in.Task.ScheduledDate, in.Now)
	switch {
	case scheduledMult > 1.0:
		explanations = append(explanations, "Scheduled today ×1.5")
	case scheduledMult < 1.0:
		explanations = append(explanations, "Scheduled future ×0.5")
	}

	score := roi * neglectMult * dp * scheduledMult
	return score, explanations
}

// computeDeadlinePressure returns a multiplier >= 1.0 based on how close either
// the hard deadline or soft deadline is.
// Hard: exp(-days/14)*10, max 10.0; overdue → 10.0.
// Soft: exp(-days/21)*5,  max 5.0;  soft overdue → 2.5 floor.
func computeDeadlinePressure(hard, soft *time.Time, now time.Time) float64 {
	pressure := 1.0

	if hard != nil {
		daysLeft := hard.Sub(now).Hours() / 24.0
		var p float64
		if daysLeft <= 0 {
			p = 10.0
		} else {
			p = math.Exp(-daysLeft/14.0) * 10.0
			if p < 1.0 {
				p = 1.0
			}
		}
		if p > pressure {
			pressure = p
		}
	}

	if soft != nil {
		daysLeft := soft.Sub(now).Hours() / 24.0
		var p float64
		if daysLeft <= 0 {
			p = 2.5 // floor for passed soft deadline
		} else {
			p = math.Exp(-daysLeft/21.0) * 5.0
			if p < 1.0 {
				p = 1.0
			}
		}
		if p > pressure {
			pressure = p
		}
	}

	return pressure
}

// computeScheduledMult returns:
//   - 1.5 if scheduled_date is today
//   - 0.5 if scheduled_date is a future date
//   - 1.0 if not scheduled or scheduled in the past
func computeScheduledMult(scheduledDate *time.Time, now time.Time) float64 {
	if scheduledDate == nil {
		return 1.0
	}
	nowDate := now.Truncate(24 * time.Hour)
	schedDate := scheduledDate.UTC().Truncate(24 * time.Hour)
	switch {
	case schedDate.Equal(nowDate):
		return 1.5
	case schedDate.After(nowDate):
		return 0.5
	default:
		return 1.0
	}
}

// RankTasks scores and sorts tasks by descending Execution Priority Score.
func RankTasks(inputs []ScoreInput) []*ScoredTask {
	result := make([]*ScoredTask, 0, len(inputs))
	for _, in := range inputs {
		score, explanations := ComputeScore(in)
		balanceScore := in.RoleBalanceScore
		neglectMult := 1.0 + 0.8*math.Max(0, 1-balanceScore)
		result = append(result, &ScoredTask{
			Task:            in.Task,
			Score:           score,
			RoleWeight:      in.RoleWeight,
			GoalWeight:      in.GoalWeight,
			RoleNeglectMult: neglectMult,
			Explanations:    explanations,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Score > result[j].Score
	})
	return result
}
