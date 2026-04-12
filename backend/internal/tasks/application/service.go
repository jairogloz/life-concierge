package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/tasks/domain"
	"github.com/jairogloz/life-concierge/internal/tasks/ports"
	timelinedomain "github.com/jairogloz/life-concierge/internal/timeline/domain"
	timelineports "github.com/jairogloz/life-concierge/internal/timeline/ports"
)

// TaskService implements ports.TaskService.
type TaskService struct {
	repo     ports.TaskRepository
	timeline timelineports.TimelineService
}

// SetTimeline wires the timeline service for event emission.
func (s *TaskService) SetTimeline(tl timelineports.TimelineService) { s.timeline = tl }

// NewTaskService creates a new TaskService.
func NewTaskService(repo ports.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) CreateTask(ctx context.Context, params ports.CreateTaskParams) (*domain.Task, error) {
	tt := params.TaskType
	if tt == "" {
		tt = domain.TaskTypeOneTime
	}
	impact := params.Impact
	if impact == 0 {
		impact = 3
	}
	effort := params.Effort
	if effort == 0 {
		effort = 3
	}
	task := &domain.Task{
		ID:               uuid.New().String(),
		UserID:           params.UserID,
		PrimaryRoleID:    params.PrimaryRoleID,
		GoalID:           params.GoalID,
		Title:            params.Title,
		Description:      params.Description,
		TaskType:         tt,
		ContextTags:      params.ContextTags,
		Impact:           impact,
		Deadline:         params.Deadline,
		SoftDeadline:     params.SoftDeadline,
		ScheduledDate:    params.ScheduledDate,
		Effort:           effort,
		EstimatedMinutes: params.EstimatedMinutes,
		CompletionLog:    []domain.CompletionEntry{},
		IsRecurring:      params.IsRecurring,
		RecurrenceRule:   params.RecurrenceRule,
		Status:           "todo",
		SecondaryRoles:   params.SecondaryRoles,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	if task.ContextTags == nil {
		task.ContextTags = []string{}
	}
	if err := task.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}
	if len(task.SecondaryRoles) > 0 {
		if err := s.repo.SetSecondaryRoles(ctx, task.ID, task.SecondaryRoles); err != nil {
			return nil, fmt.Errorf("set secondary roles: %w", err)
		}
	}
	return task, nil
}

func (s *TaskService) GetTask(ctx context.Context, userID, id string) (*domain.Task, error) {
	return s.repo.GetByID(ctx, userID, id)
}

func (s *TaskService) ListTasks(ctx context.Context, userID string, filter ports.TaskFilter) ([]*domain.Task, error) {
	tasks, err := s.repo.List(ctx, userID, filter)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	return tasks, nil
}

func (s *TaskService) UpdateTask(ctx context.Context, userID, id string, params ports.UpdateTaskParams) (*domain.Task, error) {
	task, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if params.Title != nil {
		task.Title = *params.Title
	}
	if params.Description != nil {
		task.Description = *params.Description
	}
	if params.TaskType != nil {
		task.TaskType = *params.TaskType
	}
	if params.ContextTags != nil {
		task.ContextTags = params.ContextTags
	}
	if params.Impact != nil {
		task.Impact = *params.Impact
	}
	if params.ClearDeadline {
		task.Deadline = nil
	} else if params.Deadline != nil {
		task.Deadline = params.Deadline
	}
	if params.ClearSoftDeadline {
		task.SoftDeadline = nil
	} else if params.SoftDeadline != nil {
		task.SoftDeadline = params.SoftDeadline
	}
	if params.ClearScheduledDate {
		task.ScheduledDate = nil
	} else if params.ScheduledDate != nil {
		task.ScheduledDate = params.ScheduledDate
	}
	if params.Effort != nil {
		task.Effort = *params.Effort
	}
	if params.EstimatedMinutes != nil {
		task.EstimatedMinutes = params.EstimatedMinutes
	}
	if params.IsRecurring != nil {
		task.IsRecurring = *params.IsRecurring
	}
	if params.RecurrenceRule != nil {
		task.RecurrenceRule = params.RecurrenceRule
	}
	if params.Status != nil {
		task.Status = *params.Status
	}
	task.UpdatedAt = time.Now().UTC()
	if err := task.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Update(ctx, task); err != nil {
		return nil, fmt.Errorf("update task: %w", err)
	}
	if params.SecondaryRoles != nil {
		if err := s.repo.SetSecondaryRoles(ctx, task.ID, params.SecondaryRoles); err != nil {
			return nil, fmt.Errorf("update secondary roles: %w", err)
		}
		task.SecondaryRoles = params.SecondaryRoles
	}
	return task, nil
}

func (s *TaskService) DeleteTask(ctx context.Context, userID, id string) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *TaskService) CompleteTask(ctx context.Context, userID, id string) (*domain.Task, error) {
	task, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	var updatedTask *domain.Task
	if task.TaskType == domain.TaskTypeDaily {
		// Daily tasks: append today's completion entry, keep status=todo
		today := time.Now().UTC().Format("2006-01-02")
		// Replace existing entry for today or append
		found := false
		for i, e := range task.CompletionLog {
			if e.Date == today {
				task.CompletionLog[i].Done = true
				found = true
				break
			}
		}
		if !found {
			task.CompletionLog = append(task.CompletionLog, domain.CompletionEntry{Date: today, Done: true})
		}
		task.UpdatedAt = time.Now().UTC()
		if err := s.repo.Update(ctx, task); err != nil {
			return nil, fmt.Errorf("complete daily task: %w", err)
		}
		updatedTask = task
	} else {
		// One-time tasks: set status=done
		status := "done"
		updatedTask, err = s.UpdateTask(ctx, userID, id, ports.UpdateTaskParams{Status: &status})
		if err != nil {
			return nil, err
		}
	}

	if s.timeline != nil {
		go func() {
			_, _ = s.timeline.RecordEvent(context.Background(), timelineports.RecordEventParams{
				UserID:    userID,
				EventType: timelinedomain.EventTaskCompleted,
				Domain:    "tasks",
				EntityID:  &updatedTask.ID,
				Payload:   map[string]any{"title": updatedTask.Title},
			})
		}()
	}
	return updatedTask, nil
}

func (s *TaskService) GetTaskTags(ctx context.Context, userID string) ([]string, error) {
	return s.repo.GetDistinctTags(ctx, userID)
}
