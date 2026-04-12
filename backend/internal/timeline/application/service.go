package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jairogloz/life-concierge/internal/timeline/domain"
	"github.com/jairogloz/life-concierge/internal/timeline/ports"
)

// TimelineService implements ports.TimelineService.
type TimelineService struct {
	repo ports.TimelineRepository
}

// NewTimelineService creates a new TimelineService.
func NewTimelineService(repo ports.TimelineRepository) *TimelineService {
	return &TimelineService{repo: repo}
}

// RecordEvent records a new timeline event.
func (s *TimelineService) RecordEvent(ctx context.Context, params ports.RecordEventParams) (*domain.TimelineEvent, error) {
	if params.UserID == "" {
		return nil, fmt.Errorf("timeline: user_id is required")
	}
	event := &domain.TimelineEvent{
		ID:         uuid.New(),
		UserID:     params.UserID,
		EventType:  params.EventType,
		Domain:     params.Domain,
		Payload:    params.Payload,
		OccurredAt: time.Now().UTC(),
	}
	if params.EntityID != nil {
		parsed, err := uuid.Parse(*params.EntityID)
		if err == nil {
			event.EntityID = &parsed
		}
	}
	if event.Payload == nil {
		event.Payload = map[string]any{}
	}
	if err := s.repo.Insert(ctx, event); err != nil {
		return nil, fmt.Errorf("timeline.RecordEvent: %w", err)
	}
	return event, nil
}

// ListEvents returns a paginated list of timeline events for the user.
func (s *TimelineService) ListEvents(ctx context.Context, params ports.ListEventsParams) ([]*domain.TimelineEvent, int, error) {
	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return s.repo.List(ctx, params.UserID, limit, params.Offset)
}

// compile-time interface check
var _ ports.TimelineService = (*TimelineService)(nil)
