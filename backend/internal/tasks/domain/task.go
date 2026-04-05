package domain

import (
	"errors"
	"fmt"
	"time"
)

// ErrTaskNotFound is returned when a task cannot be found.
var ErrTaskNotFound = errors.New("task not found")

// CommitmentType represents how committed a user is to a task.
type CommitmentType string

const (
	CommitmentTypeCommitment CommitmentType = "commitment"
	CommitmentTypeHabit      CommitmentType = "habit"
	CommitmentTypeRecurring  CommitmentType = "recurring"
	CommitmentTypeIntention  CommitmentType = "intention"
)

// CommitmentMultiplier maps each commitment type to its scoring multiplier.
var CommitmentMultiplier = map[CommitmentType]float64{
	CommitmentTypeCommitment: 2.0,
	CommitmentTypeHabit:      1.5,
	CommitmentTypeRecurring:  1.3,
	CommitmentTypeIntention:  1.0,
}

// ValidStatuses contains the allowed task status values.
var ValidStatuses = map[string]bool{
	"todo":        true,
	"in_progress": true,
	"done":        true,
	"archived":    true,
}

// Task represents a unit of work for the user.
type Task struct {
	ID             string         `json:"id"`
	UserID         string         `json:"user_id"`
	PrimaryRoleID  string         `json:"primary_role_id"`
	GoalID         *string        `json:"goal_id,omitempty"`
	Title          string         `json:"title"`
	Description    string         `json:"description"`
	CommitmentType CommitmentType `json:"commitment_type"`
	ContextTags    []string       `json:"context_tags"`
	Urgency        float64        `json:"urgency"`
	Deadline       *time.Time     `json:"deadline,omitempty"`
	IsRecurring    bool           `json:"is_recurring"`
	RecurrenceRule *string        `json:"recurrence_rule,omitempty"`
	Status         string         `json:"status"`
	SecondaryRoles []string       `json:"secondary_role_ids"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
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
	if t.Urgency < 1 || t.Urgency > 10 {
		return fmt.Errorf("validation: urgency must be between 1 and 10")
	}
	if _, ok := CommitmentMultiplier[t.CommitmentType]; !ok {
		return fmt.Errorf("validation: invalid commitment_type")
	}
	if t.Status != "" && !ValidStatuses[t.Status] {
		return fmt.Errorf("validation: status must be one of todo, in_progress, done, archived")
	}
	return nil
}
