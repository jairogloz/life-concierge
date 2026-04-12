package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrTaskNotFound is returned when a task cannot be found.
var ErrTaskNotFound = errors.New("task not found")

// TaskType represents the fundamental nature of a task.
type TaskType string

const (
	TaskTypeOneTime TaskType = "one_time"
	TaskTypeDaily   TaskType = "daily"
)

// TaskTypeMultiplier maps each task type to its scoring multiplier.
var TaskTypeMultiplier = map[TaskType]float64{
	TaskTypeOneTime: 1.25,
	TaskTypeDaily:   0.9,
}

// ImpactLabels provides human-readable labels for impact scores 1–5.
var ImpactLabels = map[int]string{
	1: "very low",
	2: "low",
	3: "medium",
	4: "high",
	5: "very high",
}

// ValidStatuses contains the allowed task status values.
var ValidStatuses = map[string]bool{
	"todo":        true,
	"in_progress": true,
	"done":        true,
	"archived":    true,
}

// CompletionEntry records whether a daily task was completed on a specific date.
type CompletionEntry struct {
	Date string `json:"date"` // YYYY-MM-DD
	Done bool   `json:"done"`
}

// Task represents a unit of work for the user.
type Task struct {
	ID               string            `json:"id"`
	UserID           string            `json:"user_id"`
	PrimaryRoleID    string            `json:"primary_role_id"`
	GoalID           *string           `json:"goal_id,omitempty"`
	Title            string            `json:"title"`
	Description      string            `json:"description"`
	TaskType         TaskType          `json:"task_type"`
	ContextTags      []string          `json:"context_tags"`
	Impact           int               `json:"impact"`
	Deadline         *time.Time        `json:"deadline,omitempty"`
	SoftDeadline     *time.Time        `json:"soft_deadline,omitempty"`
	ScheduledDate    *time.Time        `json:"scheduled_date,omitempty"`
	Effort           int               `json:"effort"`
	EstimatedMinutes *int              `json:"estimated_minutes,omitempty"`
	CompletionLog    []CompletionEntry `json:"completion_log"`
	IsRecurring      bool              `json:"is_recurring"`
	RecurrenceRule   *string           `json:"recurrence_rule,omitempty"`
	Status           string            `json:"status"`
	SecondaryRoles   []string          `json:"secondary_role_ids"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

// Validate checks that the task has all required fields and valid values.
func (t *Task) Validate() error {
	if t.Title == "" {
		return fmt.Errorf("validation: title is required")
	}
	if t.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if t.PrimaryRoleID == "" {
		return fmt.Errorf("validation: primary_role_id is required")
	}
	if t.Impact < 1 || t.Impact > 5 {
		return fmt.Errorf("validation: impact must be between 1 and 5")
	}
	if t.Effort < 1 || t.Effort > 5 {
		return fmt.Errorf("validation: effort must be between 1 and 5")
	}
	if t.TaskType != TaskTypeOneTime && t.TaskType != TaskTypeDaily {
		return fmt.Errorf("validation: task_type must be one_time or daily")
	}
	if t.Status != "" && !ValidStatuses[t.Status] {
		return fmt.Errorf("validation: status must be one of todo, in_progress, done, archived")
	}
	return nil
}
