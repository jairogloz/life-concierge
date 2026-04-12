package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/timeline/domain"
)

// TimelineRepository is the secondary port for persistence.
type TimelineRepository interface {
	Insert(ctx context.Context, event *domain.TimelineEvent) error
	List(ctx context.Context, userID string, limit, offset int) ([]*domain.TimelineEvent, int, error)
	ListSince(ctx context.Context, userID string, since time.Time) ([]*domain.TimelineEvent, error)
}
