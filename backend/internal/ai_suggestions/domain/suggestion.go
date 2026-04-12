package domain

import (
	"errors"
	"time"
)

// ErrSuggestionNotFound is returned when an AI suggestion cannot be found.
var ErrSuggestionNotFound = errors.New("ai suggestion not found")

// TaskSuggestion is the structured task that the AI extracted from raw text.
type TaskSuggestion struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	RoleID       string   `json:"role_id"`
	GoalID       *string  `json:"goal_id,omitempty"`
	TaskType     string   `json:"task_type"`
	Impact       int      `json:"impact"`
	ContextTags  []string `json:"context_tags"`
	DeadlineHint *string  `json:"deadline_hint,omitempty"`
}

// AISuggestion is the persistent record of an AI inbox item.
type AISuggestion struct {
	ID         string         `json:"id"`
	UserID     string         `json:"user_id"`
	RawText    string         `json:"raw_text"`
	Suggestion TaskSuggestion `json:"suggestion"`
	Status     string         `json:"status"` // pending, accepted, rejected
	TaskID     *string        `json:"task_id,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}
