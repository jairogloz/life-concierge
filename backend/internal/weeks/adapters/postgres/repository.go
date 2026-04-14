package postgres

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/weeks/domain"
	"github.com/jairogloz/life-concierge/internal/weeks/ports"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewWeeksRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListWeeks(ctx context.Context, userID, status string) ([]*domain.Week, error) {
	query := `
		SELECT id::text, user_id, starts_on::timestamptz, ends_on::timestamptz, status, started_at, closed_at, created_at, updated_at
		FROM weeks
		WHERE user_id = $1`
	args := []any{userID}
	if strings.TrimSpace(status) != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY starts_on DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("weeks.ListWeeks: %w", err)
	}
	defer rows.Close()

	out := []*domain.Week{}
	for rows.Next() {
		w := &domain.Week{}
		if err := rows.Scan(&w.ID, &w.UserID, &w.StartsOn, &w.EndsOn, &w.Status, &w.StartedAt, &w.ClosedAt, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, fmt.Errorf("weeks.ListWeeks scan: %w", err)
		}
		out = append(out, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) InsertWeek(ctx context.Context, week *domain.Week) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO weeks (id, user_id, starts_on, ends_on, status)
		VALUES ($1::uuid, $2, $3::date, $4::date, $5)
	`, week.ID, week.UserID, week.StartsOn, week.EndsOn, week.Status)
	if err != nil {
		return fmt.Errorf("weeks.InsertWeek: %w", err)
	}
	return nil
}

func (r *Repository) GetWeek(ctx context.Context, userID, weekID string) (*domain.Week, error) {
	w := &domain.Week{}
	err := r.db.QueryRow(ctx, `
		SELECT id::text, user_id, starts_on::timestamptz, ends_on::timestamptz, status, started_at, closed_at, created_at, updated_at
		FROM weeks
		WHERE user_id = $1 AND id = $2::uuid
	`, userID, weekID).Scan(&w.ID, &w.UserID, &w.StartsOn, &w.EndsOn, &w.Status, &w.StartedAt, &w.ClosedAt, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, domain.ErrWeekNotFound
		}
		return nil, fmt.Errorf("weeks.GetWeek: %w", err)
	}
	return w, nil
}

func allowed(from []domain.WeekStatus, current domain.WeekStatus) bool {
	for _, v := range from {
		if v == current {
			return true
		}
	}
	return false
}

func (r *Repository) UpdateWeekStatus(ctx context.Context, userID, weekID string, from []domain.WeekStatus, to domain.WeekStatus, now time.Time) (*domain.Week, error) {
	current, err := r.GetWeek(ctx, userID, weekID)
	if err != nil {
		return nil, err
	}
	if !allowed(from, current.Status) {
		return nil, domain.ErrInvalidTransition
	}
	_, err = r.db.Exec(ctx, `
		UPDATE weeks
		SET status = $1,
			started_at = CASE WHEN $1 = 'active' THEN COALESCE(started_at, $2) ELSE started_at END,
			closed_at = CASE WHEN $1 = 'closed' THEN COALESCE(closed_at, $2) ELSE NULL END,
			updated_at = $2
		WHERE id = $3::uuid AND user_id = $4
	`, to, now, weekID, userID)
	if err != nil {
		return nil, fmt.Errorf("weeks.UpdateWeekStatus: %w", err)
	}
	return r.GetWeek(ctx, userID, weekID)
}

func (r *Repository) CloseWeekAndCreateNextPlanning(ctx context.Context, userID, weekID string, now time.Time) (*domain.Week, *domain.Week, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("weeks.CloseWeek begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var startsOn time.Time
	var status domain.WeekStatus
	if err := tx.QueryRow(ctx, `SELECT starts_on::timestamptz, status FROM weeks WHERE id = $1::uuid AND user_id = $2`, weekID, userID).Scan(&startsOn, &status); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, domain.ErrWeekNotFound
		}
		return nil, nil, fmt.Errorf("weeks.CloseWeek load: %w", err)
	}
	if status != domain.WeekStatusReview && status != domain.WeekStatusActive {
		return nil, nil, domain.ErrInvalidTransition
	}

	if _, err := tx.Exec(ctx, `
		UPDATE weeks
		SET status = 'closed', closed_at = $1, updated_at = $1
		WHERE id = $2::uuid AND user_id = $3
	`, now, weekID, userID); err != nil {
		return nil, nil, fmt.Errorf("weeks.CloseWeek close update: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE task_week_allocations a
		SET status_snapshot = CASE WHEN t.status = 'done' THEN 'done' ELSE 'backlog' END,
			updated_at = $1
		FROM tasks t
		WHERE a.task_id = t.id
		  AND a.week_id = $2::uuid
		  AND t.user_id = $3
	`, now, weekID, userID); err != nil {
		return nil, nil, fmt.Errorf("weeks.CloseWeek backlog update: %w", err)
	}

	nextStart := startsOn.AddDate(0, 0, 7)

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("weeks.CloseWeek commit: %w", err)
	}

	closed, err := r.GetWeek(ctx, userID, weekID)
	if err != nil {
		return nil, nil, err
	}

	nextID := uuid.New().String()
	_, _ = r.db.Exec(ctx, `
		INSERT INTO weeks (id, user_id, starts_on, ends_on, status)
		VALUES ($1::uuid, $2, $3::date, $4::date, 'planning')
		ON CONFLICT DO NOTHING
	`, nextID, userID, nextStart, nextStart.AddDate(0, 0, 6))

	next := &domain.Week{}
	if err := r.db.QueryRow(ctx, `
		SELECT id::text, user_id, starts_on::timestamptz, ends_on::timestamptz, status, started_at, closed_at, created_at, updated_at
		FROM weeks
		WHERE user_id = $1 AND starts_on = $2::date
	`, userID, nextStart).Scan(&next.ID, &next.UserID, &next.StartsOn, &next.EndsOn, &next.Status, &next.StartedAt, &next.ClosedAt, &next.CreatedAt, &next.UpdatedAt); err != nil {
		if err != pgx.ErrNoRows {
			return nil, nil, fmt.Errorf("weeks.CloseWeek load next: %w", err)
		}

		if err := r.db.QueryRow(ctx, `
			SELECT id::text, user_id, starts_on::timestamptz, ends_on::timestamptz, status, started_at, closed_at, created_at, updated_at
			FROM weeks
			WHERE user_id = $1 AND status IN ('planning', 'active', 'review')
			ORDER BY starts_on ASC
			LIMIT 1
		`, userID).Scan(&next.ID, &next.UserID, &next.StartsOn, &next.EndsOn, &next.Status, &next.StartedAt, &next.ClosedAt, &next.CreatedAt, &next.UpdatedAt); err != nil {
			if err == pgx.ErrNoRows {
				return closed, nil, nil
			}
			return nil, nil, fmt.Errorf("weeks.CloseWeek load fallback open week: %w", err)
		}
	}
	return closed, next, nil
}

func (r *Repository) ListPriorities(ctx context.Context, userID, weekID string) ([]*domain.WeekPriority, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id::text, p.week_id::text, p.text, p.order_index, p.created_at, p.updated_at
		FROM week_priorities p
		JOIN weeks w ON w.id = p.week_id
		WHERE w.user_id = $1 AND p.week_id = $2::uuid
		ORDER BY p.order_index ASC, p.created_at ASC
	`, userID, weekID)
	if err != nil {
		return nil, fmt.Errorf("weeks.ListPriorities: %w", err)
	}
	defer rows.Close()

	out := []*domain.WeekPriority{}
	for rows.Next() {
		p := &domain.WeekPriority{}
		if err := rows.Scan(&p.ID, &p.WeekID, &p.Text, &p.OrderIndex, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("weeks.ListPriorities scan: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) InsertPriority(ctx context.Context, priority *domain.WeekPriority) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO week_priorities (id, week_id, text, order_index)
		VALUES ($1::uuid, $2::uuid, $3, $4)
	`, priority.ID, priority.WeekID, priority.Text, priority.OrderIndex)
	if err != nil {
		return fmt.Errorf("weeks.InsertPriority: %w", err)
	}
	return nil
}

func (r *Repository) DeletePriority(ctx context.Context, userID, weekID, priorityID string) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM week_priorities p
		USING weeks w
		WHERE p.week_id = w.id
		  AND w.user_id = $1
		  AND p.week_id = $2::uuid
		  AND p.id = $3::uuid
	`, userID, weekID, priorityID)
	if err != nil {
		return fmt.Errorf("weeks.DeletePriority: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrWeekNotFound
	}
	return nil
}

func (r *Repository) ListAllocations(ctx context.Context, userID, weekID string) ([]*domain.TaskAllocation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			a.id::text,
			a.week_id::text,
			a.task_id::text,
			a.day_of_week,
			a.slot_minute_of_day,
			a.lane,
			a.status_snapshot,
			t.title,
			t.status,
			t.primary_role_id::text,
			r.name,
			COALESCE(r.color, '#6366f1') as role_color,
			t.estimated_minutes,
			t.impact,
			a.created_at,
			a.updated_at
		FROM task_week_allocations a
		JOIN weeks w ON w.id = a.week_id
		JOIN tasks t ON t.id = a.task_id
		JOIN roles r ON r.id = t.primary_role_id
		WHERE w.user_id = $1 AND a.week_id = $2::uuid
		ORDER BY a.day_of_week, a.lane, a.slot_minute_of_day NULLS FIRST, a.created_at
	`, userID, weekID)
	if err != nil {
		return nil, fmt.Errorf("weeks.ListAllocations: %w", err)
	}
	defer rows.Close()

	out := []*domain.TaskAllocation{}
	for rows.Next() {
		item := &domain.TaskAllocation{}
		if err := rows.Scan(
			&item.ID,
			&item.WeekID,
			&item.TaskID,
			&item.DayOfWeek,
			&item.SlotMinuteOfDay,
			&item.Lane,
			&item.StatusSnapshot,
			&item.TaskTitle,
			&item.TaskStatus,
			&item.RoleID,
			&item.RoleName,
			&item.RoleColor,
			&item.EstimatedMinutes,
			&item.Impact,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("weeks.ListAllocations scan: %w", err)
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) UpsertAllocation(ctx context.Context, allocation *domain.TaskAllocation) error {
	cmd, err := r.db.Exec(ctx, `
		INSERT INTO task_week_allocations (id, task_id, week_id, day_of_week, slot_minute_of_day, lane, status_snapshot)
		SELECT $1::uuid, t.id, $2::uuid, $3, $4, $5, 'planned'
		FROM tasks t
		JOIN weeks w ON w.id = $2::uuid
		WHERE t.id = $6::uuid AND t.user_id = w.user_id
		ON CONFLICT (task_id, week_id)
		DO UPDATE SET
			day_of_week = EXCLUDED.day_of_week,
			slot_minute_of_day = EXCLUDED.slot_minute_of_day,
			lane = EXCLUDED.lane,
			status_snapshot = 'planned',
			updated_at = NOW()
	`, allocation.ID, allocation.WeekID, allocation.DayOfWeek, allocation.SlotMinuteOfDay, allocation.Lane, allocation.TaskID)
	if err != nil {
		return fmt.Errorf("weeks.UpsertAllocation: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("weeks.UpsertAllocation: task or week not found")
	}
	return nil
}

func (r *Repository) DeleteAllocation(ctx context.Context, userID, weekID, allocationID string) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM task_week_allocations a
		USING weeks w
		WHERE a.week_id = w.id
		  AND w.user_id = $1
		  AND a.week_id = $2::uuid
		  AND a.id = $3::uuid
	`, userID, weekID, allocationID)
	if err != nil {
		return fmt.Errorf("weeks.DeleteAllocation: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return domain.ErrWeekNotFound
	}
	return nil
}

func parseTaskIDs(taskIDs []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(taskIDs))
	for _, value := range taskIDs {
		parsed, err := uuid.Parse(value)
		if err != nil {
			return nil, fmt.Errorf("invalid uuid %q", value)
		}
		out = append(out, parsed)
	}
	return out, nil
}

func (r *Repository) nextPlanningWeekID(ctx context.Context, tx pgx.Tx, userID, weekID string) (string, error) {
	var startsOn time.Time
	if err := tx.QueryRow(ctx, `SELECT starts_on::timestamptz FROM weeks WHERE id = $1::uuid AND user_id = $2`, weekID, userID).Scan(&startsOn); err != nil {
		if err == pgx.ErrNoRows {
			return "", domain.ErrWeekNotFound
		}
		return "", err
	}
	nextStart := startsOn.AddDate(0, 0, 7)
	nextID := uuid.New().String()
	if _, err := tx.Exec(ctx, `
		INSERT INTO weeks (id, user_id, starts_on, ends_on, status)
		VALUES ($1::uuid, $2, $3::date, $4::date, 'planning')
		ON CONFLICT (user_id, starts_on, ends_on) DO NOTHING
	`, nextID, userID, nextStart, nextStart.AddDate(0, 0, 6)); err != nil {
		return "", err
	}
	var resolved string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM weeks WHERE user_id = $1 AND starts_on = $2::date`, userID, nextStart).Scan(&resolved); err != nil {
		return "", err
	}
	return resolved, nil
}

func (r *Repository) ApplyReviewAction(ctx context.Context, action domain.ReviewAction, userID, weekID string, taskIDs []string, now time.Time, explicitToWeekID *string) error {
	uuidIDs, err := parseTaskIDs(taskIDs)
	if err != nil {
		return err
	}
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("weeks.ApplyReviewAction begin: %w", err)
	}
	defer tx.Rollback(ctx)

	var status domain.WeekStatus
	if err := tx.QueryRow(ctx, `SELECT status FROM weeks WHERE id = $1::uuid AND user_id = $2`, weekID, userID).Scan(&status); err != nil {
		if err == pgx.ErrNoRows {
			return domain.ErrWeekNotFound
		}
		return err
	}
	if status != domain.WeekStatusReview && status != domain.WeekStatusActive {
		return domain.ErrInvalidTransition
	}

	switch action {
	case domain.ReviewActionDone:
		if _, err := tx.Exec(ctx, `
			UPDATE tasks
			SET status = 'done', updated_at = $1
			WHERE user_id = $2 AND id = ANY($3)
		`, now, userID, uuidIDs); err != nil {
			return fmt.Errorf("weeks.ApplyReviewAction done tasks: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE task_week_allocations a
			SET status_snapshot = 'done', updated_at = $1
			FROM weeks w
			WHERE a.week_id = w.id
			  AND w.user_id = $2
			  AND a.week_id = $3::uuid
			  AND a.task_id = ANY($4)
		`, now, userID, weekID, uuidIDs); err != nil {
			return fmt.Errorf("weeks.ApplyReviewAction done allocations: %w", err)
		}

	case domain.ReviewActionBacklog:
		if _, err := tx.Exec(ctx, `
			UPDATE task_week_allocations a
			SET status_snapshot = 'backlog', updated_at = $1
			FROM weeks w
			WHERE a.week_id = w.id
			  AND w.user_id = $2
			  AND a.week_id = $3::uuid
			  AND a.task_id = ANY($4)
		`, now, userID, weekID, uuidIDs); err != nil {
			return fmt.Errorf("weeks.ApplyReviewAction backlog allocations: %w", err)
		}

	case domain.ReviewActionMoveNext:
		toWeekID := ""
		if explicitToWeekID != nil && strings.TrimSpace(*explicitToWeekID) != "" {
			toWeekID = *explicitToWeekID
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM weeks WHERE id = $1::uuid AND user_id = $2)`, toWeekID, userID).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				return domain.ErrWeekNotFound
			}
		} else {
			resolved, err := r.nextPlanningWeekID(ctx, tx, userID, weekID)
			if err != nil {
				return err
			}
			toWeekID = resolved
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO task_week_allocations (id, task_id, week_id, day_of_week, slot_minute_of_day, lane, status_snapshot)
			SELECT uuid_generate_v4(), a.task_id, $1::uuid, a.day_of_week, a.slot_minute_of_day, a.lane, 'planned'
			FROM task_week_allocations a
			JOIN weeks w ON w.id = a.week_id
			JOIN tasks t ON t.id = a.task_id
			WHERE w.user_id = $2
			  AND a.week_id = $3::uuid
			  AND a.task_id = ANY($4)
			  AND t.user_id = $2
			ON CONFLICT (task_id, week_id)
			DO UPDATE SET
				day_of_week = EXCLUDED.day_of_week,
				slot_minute_of_day = EXCLUDED.slot_minute_of_day,
				lane = EXCLUDED.lane,
				status_snapshot = 'planned',
				updated_at = NOW()
		`, toWeekID, userID, weekID, uuidIDs); err != nil {
			return fmt.Errorf("weeks.ApplyReviewAction move copy: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE task_week_allocations a
			SET status_snapshot = 'moved', updated_at = $1
			FROM weeks w
			WHERE a.week_id = w.id
			  AND w.user_id = $2
			  AND a.week_id = $3::uuid
			  AND a.task_id = ANY($4)
		`, now, userID, weekID, uuidIDs); err != nil {
			return fmt.Errorf("weeks.ApplyReviewAction move mark: %w", err)
		}
	default:
		return fmt.Errorf("unsupported action")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("weeks.ApplyReviewAction commit: %w", err)
	}
	return nil
}

func pct(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func ratio(n, d float64) float64 {
	if d <= 0 {
		return 0
	}
	return n / d
}

func (r *Repository) GetBalanceSnapshot(ctx context.Context, userID, weekID string) (*domain.WeekBalanceSnapshot, error) {
	type row struct {
		RoleID   string
		RoleName string
		Color    string
		Weight   float64
		Done     float64
		Planned  float64
	}

	rows, err := r.db.Query(ctx, `
		WITH done_counts AS (
			SELECT t.primary_role_id::text AS role_id, COUNT(*)::float8 AS c
			FROM task_week_allocations a
			JOIN tasks t ON t.id = a.task_id
			JOIN weeks w ON w.id = a.week_id
			WHERE w.user_id = $1
			  AND a.week_id = $2::uuid
			  AND (t.status = 'done' OR a.status_snapshot = 'done')
			GROUP BY t.primary_role_id
		),
		planned_counts AS (
			SELECT t.primary_role_id::text AS role_id, COUNT(*)::float8 AS c
			FROM task_week_allocations a
			JOIN tasks t ON t.id = a.task_id
			JOIN weeks w ON w.id = a.week_id
			WHERE w.user_id = $1
			  AND a.week_id = $2::uuid
			GROUP BY t.primary_role_id
		)
		SELECT
			r.id::text,
			r.name,
			COALESCE(r.color, '#6366f1') AS color,
			COALESCE(r.weight, 1.0) AS weight,
			COALESCE(d.c, 0),
			COALESCE(p.c, 0)
		FROM roles r
		LEFT JOIN done_counts d ON d.role_id = r.id::text
		LEFT JOIN planned_counts p ON p.role_id = r.id::text
		WHERE r.user_id = $1
		ORDER BY r.name ASC
	`, userID, weekID)
	if err != nil {
		return nil, fmt.Errorf("weeks.GetBalanceSnapshot query: %w", err)
	}
	defer rows.Close()

	entries := []row{}
	var totalW float64
	var totalDone float64
	var totalPlanned float64
	for rows.Next() {
		var item row
		if err := rows.Scan(&item.RoleID, &item.RoleName, &item.Color, &item.Weight, &item.Done, &item.Planned); err != nil {
			return nil, fmt.Errorf("weeks.GetBalanceSnapshot scan: %w", err)
		}
		entries = append(entries, item)
		totalW += item.Weight
		totalDone += item.Done
		totalPlanned += item.Planned
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	current := make([]domain.BalancePoint, 0, len(entries))
	target := make([]domain.BalancePoint, 0, len(entries))
	for _, item := range entries {
		expected := ratio(item.Weight, totalW)
		cur := pct(ratio(ratio(item.Done, totalDone), expected) * 100)
		tar := pct(ratio(ratio(item.Planned, totalPlanned), expected) * 100)
		current = append(current, domain.BalancePoint{RoleID: item.RoleID, RoleName: item.RoleName, Color: item.Color, Value: math.Round(cur*10) / 10})
		target = append(target, domain.BalancePoint{RoleID: item.RoleID, RoleName: item.RoleName, Color: item.Color, Value: math.Round(tar*10) / 10})
	}
	sort.Slice(current, func(i, j int) bool { return current[i].RoleName < current[j].RoleName })
	sort.Slice(target, func(i, j int) bool { return target[i].RoleName < target[j].RoleName })

	return &domain.WeekBalanceSnapshot{Current: current, Target: target}, nil
}

var _ ports.WeeksRepository = (*Repository)(nil)
