package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/timeline/domain"
)

// RecordEventParams holds the data required to record a new timeline event.
type RecordEventParams struct {
	UserID    string
	EventType domain.EventType
	Domain    string
	EntityID  *string        // optional UUID string
	Payload   map[string]any // arbitrary context data
}

// ListEventsParams controls pagination for event listing.
type ListEventsParams struct {
	UserID string
	Limit  int
	Offset int
}

// TimelineService is the primary port for the timeline domain.
type TimelineService interface {
	RecordEvent(ctx context.Context, params RecordEventParams) (*domain.TimelineEvent, error)
	ListEvents(ctx context.Context, params ListEventsParams) ([]*domain.TimelineEvent, int, error)
}
