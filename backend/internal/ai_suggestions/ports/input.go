package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
)

// InboxService defines the input port for the AI inbox.
type InboxService interface {
	ProcessRawText(ctx context.Context, userID, rawText string) (*domain.AISuggestion, error)
	GetSuggestion(ctx context.Context, userID, id string) (*domain.AISuggestion, error)
	ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error)
	Accept(ctx context.Context, userID, id string) (taskID string, err error)
	Reject(ctx context.Context, userID, id string) error
}
