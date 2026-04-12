package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/tasks/domain"
	"github.com/jairogloz/life-concierge/internal/tasks/ports"
)

const taskColumns = `id, user_id, primary_role_id, goal_id, title, description,
    task_type, context_tags, impact, deadline, soft_deadline, scheduled_date,
    effort, estimated_minutes, completion_log,
    is_recurring, recurrence_rule, status, created_at, updated_at`

// TaskRepository is a PostgreSQL implementation of ports.TaskRepository.
type TaskRepository struct {
	db *pgxpool.Pool
}

// NewTaskRepository creates a new PostgreSQL-backed TaskRepository.
func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(ctx context.Context, task *domain.Task) error {
	logBytes, err := json.Marshal(task.CompletionLog)
	if err != nil {
		return fmt.Errorf("tasks.Create marshal log: %w", err)
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO tasks (`+taskColumns+`)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
		task.ID, task.UserID, task.PrimaryRoleID, task.GoalID,
		task.Title, task.Description, task.TaskType, task.ContextTags,
		task.Impact, task.Deadline, task.SoftDeadline, task.ScheduledDate,
		task.Effort, task.EstimatedMinutes, logBytes,
		task.IsRecurring, task.RecurrenceRule, task.Status,
		task.CreatedAt, task.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("tasks.Create: %w", err)
	}
	return nil
}

func (r *TaskRepository) GetByID(ctx context.Context, userID, id string) (*domain.Task, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+taskColumns+` FROM tasks WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	task, err := scanTask(row)
	if err != nil {
		return nil, err
	}
	if err := r.loadSecondaryRoles(ctx, task); err != nil {
		return nil, err
	}
	return task, nil
}

func (r *TaskRepository) List(ctx context.Context, userID string, filter ports.TaskFilter) ([]*domain.Task, error) {
	query := `SELECT ` + taskColumns + ` FROM tasks WHERE user_id=$1`
	args := []any{userID}
	idx := 2

	if filter.RoleID != "" {
		query += fmt.Sprintf(` AND primary_role_id=$%d`, idx)
		args = append(args, filter.RoleID)
		idx++
	}
	if filter.GoalID != "" {
		query += fmt.Sprintf(` AND goal_id=$%d`, idx)
		args = append(args, filter.GoalID)
		idx++
	}
	if filter.Status != "" {
		query += fmt.Sprintf(` AND status=$%d`, idx)
		args = append(args, filter.Status)
		idx++
	}
	if filter.Context != "" {
		query += fmt.Sprintf(` AND $%d=ANY(context_tags)`, idx)
		args = append(args, filter.Context)
		idx++
	}
	if filter.ScheduledDate != "" {
		query += fmt.Sprintf(` AND scheduled_date=$%d`, idx)
		args = append(args, filter.ScheduledDate)
		idx++
	}
	if filter.ScheduledFrom != "" {
		query += fmt.Sprintf(` AND scheduled_date >= $%d::date`, idx)
		args = append(args, filter.ScheduledFrom)
		idx++
	}
	if filter.ScheduledTo != "" {
		query += fmt.Sprintf(` AND scheduled_date <= $%d::date`, idx)
		args = append(args, filter.ScheduledTo)
		idx++
	}
	if filter.DueFrom != "" {
		query += fmt.Sprintf(` AND deadline IS NOT NULL AND deadline::date >= $%d::date`, idx)
		args = append(args, filter.DueFrom)
		idx++
	}
	if filter.DueTo != "" {
		query += fmt.Sprintf(` AND deadline IS NOT NULL AND deadline::date <= $%d::date`, idx)
		args = append(args, filter.DueTo)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("tasks.List: %w", err)
	}
	defer rows.Close()

	var tasks []*domain.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("tasks.List rows: %w", err)
	}

	for _, t := range tasks {
		if err := r.loadSecondaryRoles(ctx, t); err != nil {
			return nil, err
		}
	}
	return tasks, nil
}

func (r *TaskRepository) Update(ctx context.Context, task *domain.Task) error {
	logBytes, err := json.Marshal(task.CompletionLog)
	if err != nil {
		return fmt.Errorf("tasks.Update marshal log: %w", err)
	}
	_, err = r.db.Exec(ctx,
		`UPDATE tasks
		    SET title=$1, description=$2, task_type=$3, context_tags=$4,
		        impact=$5, deadline=$6, soft_deadline=$7, scheduled_date=$8,
		        effort=$9, estimated_minutes=$10, completion_log=$11,
		        is_recurring=$12, recurrence_rule=$13, status=$14, updated_at=$15
		  WHERE id=$16 AND user_id=$17`,
		task.Title, task.Description, task.TaskType, task.ContextTags,
		task.Impact, task.Deadline, task.SoftDeadline, task.ScheduledDate,
		task.Effort, task.EstimatedMinutes, logBytes,
		task.IsRecurring, task.RecurrenceRule, task.Status, task.UpdatedAt,
		task.ID, task.UserID,
	)
	if err != nil {
		return fmt.Errorf("tasks.Update: %w", err)
	}
	return nil
}

func (r *TaskRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM tasks WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return fmt.Errorf("tasks.Delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTaskNotFound
	}
	return nil
}

func (r *TaskRepository) SetSecondaryRoles(ctx context.Context, taskID string, roleIDs []string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM task_secondary_roles WHERE task_id=$1`, taskID)
	if err != nil {
		return fmt.Errorf("tasks.SetSecondaryRoles delete: %w", err)
	}
	if len(roleIDs) == 0 {
		return nil
	}
	values := make([]string, len(roleIDs))
	args := make([]any, len(roleIDs)*2)
	for i, rid := range roleIDs {
		values[i] = fmt.Sprintf("($%d,$%d)", i*2+1, i*2+2)
		args[i*2] = taskID
		args[i*2+1] = rid
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO task_secondary_roles(task_id,role_id) VALUES `+strings.Join(values, ","),
		args...,
	)
	if err != nil {
		return fmt.Errorf("tasks.SetSecondaryRoles insert: %w", err)
	}
	return nil
}

func (r *TaskRepository) GetDistinctTags(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.Query(ctx,
		`SELECT DISTINCT unnest(context_tags) AS tag
		   FROM tasks
		  WHERE user_id=$1 AND context_tags IS NOT NULL
		  ORDER BY tag`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("tasks.GetDistinctTags: %w", err)
	}
	defer rows.Close()
	var tags []string
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	if tags == nil {
		tags = []string{}
	}
	return tags, rows.Err()
}

// ── helpers ───────────────────────────────────────────────────────────────────

type scanner interface {
	Scan(dest ...any) error
}

func scanTask(row scanner) (*domain.Task, error) {
	t := &domain.Task{}
	var logBytes []byte
	err := row.Scan(
		&t.ID, &t.UserID, &t.PrimaryRoleID, &t.GoalID,
		&t.Title, &t.Description, &t.TaskType, &t.ContextTags,
		&t.Impact, &t.Deadline, &t.SoftDeadline, &t.ScheduledDate,
		&t.Effort, &t.EstimatedMinutes, &logBytes,
		&t.IsRecurring, &t.RecurrenceRule, &t.Status,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrTaskNotFound
		}
		return nil, fmt.Errorf("tasks.scan: %w", err)
	}
	if t.ContextTags == nil {
		t.ContextTags = []string{}
	}
	if len(logBytes) > 0 {
		if err := json.Unmarshal(logBytes, &t.CompletionLog); err != nil {
			t.CompletionLog = []domain.CompletionEntry{}
		}
	}
	if t.CompletionLog == nil {
		t.CompletionLog = []domain.CompletionEntry{}
	}
	t.SecondaryRoles = []string{}
	return t, nil
}

func (r *TaskRepository) loadSecondaryRoles(ctx context.Context, task *domain.Task) error {
	rows, err := r.db.Query(ctx,
		`SELECT role_id FROM task_secondary_roles WHERE task_id=$1`,
		task.ID,
	)
	if err != nil {
		return fmt.Errorf("tasks.loadSecondaryRoles: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var rid string
		if err := rows.Scan(&rid); err != nil {
			return fmt.Errorf("tasks.loadSecondaryRoles scan: %w", err)
		}
		task.SecondaryRoles = append(task.SecondaryRoles, rid)
	}
	return rows.Err()
}

// Ensure TaskRepository satisfies the port interface at compile time.
var _ ports.TaskRepository = (*TaskRepository)(nil)
