package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/ranking/domain"
	"github.com/jairogloz/life-concierge/internal/ranking/ports"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// RankingRepository is a PostgreSQL implementation of ports.RankingRepository.
type RankingRepository struct {
	db *pgxpool.Pool
}

// NewRankingRepository creates a new PostgreSQL-backed RankingRepository.
func NewRankingRepository(db *pgxpool.Pool) *RankingRepository {
	return &RankingRepository{db: db}
}

func (r *RankingRepository) FetchScoringInputs(ctx context.Context, userID string, filter ports.RankFilter) ([]domain.ScoreInput, error) {
	query := `
		SELECT
		    t.id, t.user_id, t.primary_role_id, t.goal_id,
		    t.title, t.description, t.task_type, t.context_tags,
		    t.impact, t.deadline, t.soft_deadline, t.scheduled_date,
		    t.effort, t.estimated_minutes, t.completion_log,
		    t.is_recurring, t.recurrence_rule, t.status,
		    t.created_at, t.updated_at,
		    r.weight AS role_weight,
		    COALESCE(g.weight, 1.0) AS goal_weight
		FROM tasks t
		JOIN  roles r  ON r.id = t.primary_role_id
		LEFT JOIN goals g ON g.id = t.goal_id
		WHERE t.user_id = $1
		  AND t.status NOT IN ('done','archived')
	`
	args := []any{userID}
	idx := 2

	if filter.RoleID != "" {
		query += fmt.Sprintf(` AND t.primary_role_id = $%d`, idx)
		args = append(args, filter.RoleID)
		idx++
	}
	if filter.Context != "" {
		query += fmt.Sprintf(` AND $%d = ANY(t.context_tags)`, idx)
		args = append(args, filter.Context)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("ranking.FetchScoringInputs: %w", err)
	}
	defer rows.Close()

	now := time.Now().UTC()
	var inputs []domain.ScoreInput
	for rows.Next() {
		t := &taskdomain.Task{}
		var roleWeight, goalWeight float64
		var logBytes []byte
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.PrimaryRoleID, &t.GoalID,
			&t.Title, &t.Description, &t.TaskType, &t.ContextTags,
			&t.Impact, &t.Deadline, &t.SoftDeadline, &t.ScheduledDate,
			&t.Effort, &t.EstimatedMinutes, &logBytes,
			&t.IsRecurring, &t.RecurrenceRule, &t.Status,
			&t.CreatedAt, &t.UpdatedAt,
			&roleWeight, &goalWeight,
		); err != nil {
			return nil, fmt.Errorf("ranking.scan: %w", err)
		}
		if t.ContextTags == nil {
			t.ContextTags = []string{}
		}
		if len(logBytes) > 0 {
			_ = json.Unmarshal(logBytes, &t.CompletionLog)
		}
		if t.CompletionLog == nil {
			t.CompletionLog = []taskdomain.CompletionEntry{}
		}
		t.SecondaryRoles = []string{}
		inputs = append(inputs, domain.ScoreInput{
			Task:       t,
			RoleWeight: roleWeight,
			GoalWeight: goalWeight,
			Now:        now,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ranking.rows: %w", err)
	}
	return inputs, nil
}

// Ensure RankingRepository satisfies the port interface at compile time.
var _ ports.RankingRepository = (*RankingRepository)(nil)
