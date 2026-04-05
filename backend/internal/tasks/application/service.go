package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/tasks/domain"
	"github.com/jairogloz/life-concierge/internal/tasks/ports"
)

// TaskService implements ports.TaskService.
type TaskService struct {
	repo ports.TaskRepository
}

// NewTaskService creates a new TaskService.
func NewTaskService(repo ports.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) CreateTask(ctx context.Context, params ports.CreateTaskParams) (*domain.Task, error) {
	ct := params.CommitmentType
	if ct == "" {
		ct = domain.CommitmentTypeIntention
	}
	urgency := params.Urgency
	if urgency == 0 {
		urgency = 5.0
	}
	task := &domain.Task{
		ID:             uuid.New().String(),
		UserID:         params.UserID,
		PrimaryRoleID:  params.PrimaryRoleID,
		GoalID:         params.GoalID,
		Title:          params.Title,
		Description:    params.Description,
		CommitmentType: ct,
		ContextTags:    params.ContextTags,
		Urgency:        urgency,
		Deadline:       params.Deadline,
		IsRecurring:    params.IsRecurring,
		RecurrenceRule: params.RecurrenceRule,
		Status:         "todo",
		SecondaryRoles: params.SecondaryRoles,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
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
	if params.CommitmentType != nil {
		task.CommitmentType = *params.CommitmentType
	}
	if params.ContextTags != nil {
		task.ContextTags = params.ContextTags
	}
	if params.Urgency != nil {
		task.Urgency = *params.Urgency
	}
	if params.ClearDeadline {
		task.Deadline = nil
	} else if params.Deadline != nil {
		task.Deadline = params.Deadline
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
	status := "done"
	return s.UpdateTask(ctx, userID, id, ports.UpdateTaskParams{Status: &status})
}
