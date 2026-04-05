package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
)

// SuggestionRepository is a PostgreSQL implementation of ports.SuggestionRepository.
type SuggestionRepository struct {
	db *pgxpool.Pool
}

// NewSuggestionRepository creates a new PostgreSQL-backed SuggestionRepository.
func NewSuggestionRepository(db *pgxpool.Pool) *SuggestionRepository {
	return &SuggestionRepository{db: db}
}

func (r *SuggestionRepository) Create(ctx context.Context, s *domain.AISuggestion) error {
	suggJSON, err := json.Marshal(s.Suggestion)
	if err != nil {
		return fmt.Errorf("suggest.Create marshal: %w", err)
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO ai_suggestions (id, user_id, raw_text, suggestion, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.UserID, s.RawText, suggJSON, s.Status, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("suggest.Create: %w", err)
	}
	return nil
}

func (r *SuggestionRepository) GetByID(ctx context.Context, userID, id string) (*domain.AISuggestion, error) {
	row := r.db.QueryRow(ctx,
		`SELECT id, user_id, raw_text, suggestion, status, task_id, created_at, updated_at
		   FROM ai_suggestions WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	return scanSuggestion(row)
}

func (r *SuggestionRepository) ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, raw_text, suggestion, status, task_id, created_at, updated_at
		   FROM ai_suggestions WHERE user_id=$1 AND status='pending' ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("suggest.ListPending: %w", err)
	}
	defer rows.Close()
	var results []*domain.AISuggestion
	for rows.Next() {
		s, err := scanSuggestion(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	return results, rows.Err()
}

func (r *SuggestionRepository) UpdateStatus(ctx context.Context, id, status string, taskID *string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE ai_suggestions SET status=$1, task_id=$2, updated_at=NOW() WHERE id=$3`,
		status, taskID, id,
	)
	if err != nil {
		return fmt.Errorf("suggest.UpdateStatus: %w", err)
	}
	return nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanSuggestion(row scanner) (*domain.AISuggestion, error) {
	s := &domain.AISuggestion{}
	var suggJSON []byte
	err := row.Scan(&s.ID, &s.UserID, &s.RawText, &suggJSON, &s.Status, &s.TaskID, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSuggestionNotFound
		}
		return nil, fmt.Errorf("suggest.scan: %w", err)
	}
	if err := json.Unmarshal(suggJSON, &s.Suggestion); err != nil {
		return nil, fmt.Errorf("suggest.unmarshal: %w", err)
	}
	return s, nil
}

// Ensure SuggestionRepository satisfies the port interface at compile time.
var _ ports.SuggestionRepository = (*SuggestionRepository)(nil)
