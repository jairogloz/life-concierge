package domain

import (
	"time"

	"github.com/google/uuid"
)

// EventType identifies the kind of life event that occurred.
type EventType string

const (
	EventTaskCompleted  EventType = "task_completed"
	EventExpenseLogged  EventType = "expense_logged"
	EventWishlistEval   EventType = "wishlist_evaluated"
	EventRoleUpdated    EventType = "role_updated"
	EventGoalUpdated    EventType = "goal_updated"
)

// TimelineEvent is an immutable record of a significant life event.
type TimelineEvent struct {
	ID         uuid.UUID      `json:"id"`
	UserID     string         `json:"user_id"`
	EventType  EventType      `json:"event_type"`
	Domain     string         `json:"domain"`
	EntityID   *uuid.UUID     `json:"entity_id,omitempty"`
	Payload    map[string]any `json:"payload"`
	OccurredAt time.Time      `json:"occurred_at"`
}
