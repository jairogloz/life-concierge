package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
)

// SuggestionRepository defines the driven port for AI suggestion persistence.
type SuggestionRepository interface {
	Create(ctx context.Context, s *domain.AISuggestion) error
	GetByID(ctx context.Context, userID, id string) (*domain.AISuggestion, error)
	ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error)
	UpdateStatus(ctx context.Context, id, status string, taskID *string) error
}

// TaskAgent generates a structured task suggestion from raw text.
type TaskAgent interface {
	Extract(ctx context.Context, userID, rawText string, roles []RoleContext, goals []GoalContext) (*domain.TaskSuggestion, error)
}

// RoleContext is a slim role descriptor passed to the AI agent.
type RoleContext struct {
	ID   string
	Name string
}

// GoalContext is a slim goal descriptor passed to the AI agent.
type GoalContext struct {
	ID     string
	Title  string
	RoleID string
}
