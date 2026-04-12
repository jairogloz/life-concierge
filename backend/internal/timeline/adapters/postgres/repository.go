package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jairogloz/life-concierge/internal/timeline/domain"
	"github.com/jairogloz/life-concierge/internal/timeline/ports"
)

// TimelineRepository is a PostgreSQL-backed timeline repository.
type TimelineRepository struct {
	db *pgxpool.Pool
}

// NewTimelineRepository creates a new PostgreSQL-backed TimelineRepository.
func NewTimelineRepository(db *pgxpool.Pool) *TimelineRepository {
	return &TimelineRepository{db: db}
}

// Insert persists a new timeline event.
func (r *TimelineRepository) Insert(ctx context.Context, event *domain.TimelineEvent) error {
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("timeline.Insert marshal: %w", err)
	}
	var entityID *string
	if event.EntityID != nil {
		s := event.EntityID.String()
		entityID = &s
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO timeline_events (id, user_id, event_type, domain, entity_id, payload, occurred_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		event.ID.String(), event.UserID, string(event.EventType), event.Domain,
		entityID, payloadBytes, event.OccurredAt,
	)
	if err != nil {
		return fmt.Errorf("timeline.Insert: %w", err)
	}
	return nil
}

func scanEvent(row interface{ Scan(...any) error }) (*domain.TimelineEvent, error) {
	var (
		idStr       string
		entityIDStr *string
		evtType     string
		payloadRaw  []byte
	)
	event := &domain.TimelineEvent{}
	err := row.Scan(&idStr, &event.UserID, &evtType, &event.Domain, &entityIDStr, &payloadRaw, &event.OccurredAt)
	if err != nil {
		return nil, err
	}
	event.ID, _ = uuid.Parse(idStr)
	event.EventType = domain.EventType(evtType)
	if entityIDStr != nil {
		parsed, err := uuid.Parse(*entityIDStr)
		if err == nil {
			event.EntityID = &parsed
		}
	}
	if err := json.Unmarshal(payloadRaw, &event.Payload); err != nil {
		event.Payload = map[string]any{}
	}
	return event, nil
}

// List returns paginated timeline events for the user, most recent first.
func (r *TimelineRepository) List(ctx context.Context, userID string, limit, offset int) ([]*domain.TimelineEvent, int, error) {
	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM timeline_events WHERE user_id=$1`, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("timeline.List count: %w", err)
	}
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, event_type, domain, entity_id, payload, occurred_at
		 FROM timeline_events WHERE user_id=$1
		 ORDER BY occurred_at DESC LIMIT $2 OFFSET $3`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("timeline.List query: %w", err)
	}
	defer rows.Close()
	var events []*domain.TimelineEvent
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("timeline.List scan: %w", err)
		}
		events = append(events, event)
	}
	return events, total, rows.Err()
}

// ListSince returns events for the user since the given time.
func (r *TimelineRepository) ListSince(ctx context.Context, userID string, since time.Time) ([]*domain.TimelineEvent, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, event_type, domain, entity_id, payload, occurred_at
		 FROM timeline_events WHERE user_id=$1 AND occurred_at >= $2
		 ORDER BY occurred_at DESC`,
		userID, since,
	)
	if err != nil {
		return nil, fmt.Errorf("timeline.ListSince: %w", err)
	}
	defer rows.Close()
	var events []*domain.TimelineEvent
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, fmt.Errorf("timeline.ListSince scan: %w", err)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

var _ ports.TimelineRepository = (*TimelineRepository)(nil)
