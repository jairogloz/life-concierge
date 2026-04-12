package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
	tasksports "github.com/jairogloz/life-concierge/internal/tasks/ports"
)

// InboxService orchestrates the AI inbox.
type InboxService struct {
	repo      ports.SuggestionRepository
	agent     ports.TaskAgent
	rolesRepo RoleReader
	goalsRepo GoalReader
	tasksvc   tasksports.TaskService
}

// RoleReader fetches role context for the AI agent.
type RoleReader interface {
	List(ctx context.Context, userID string) ([]ports.RoleContext, error)
}

// GoalReader fetches goal context for the AI agent.
type GoalReader interface {
	List(ctx context.Context, userID string) ([]ports.GoalContext, error)
}

// NewInboxService creates a new InboxService.
func NewInboxService(
	repo ports.SuggestionRepository,
	agent ports.TaskAgent,
	rolesRepo RoleReader,
	goalsRepo GoalReader,
	tasksvc tasksports.TaskService,
) *InboxService {
	return &InboxService{
		repo:      repo,
		agent:     agent,
		rolesRepo: rolesRepo,
		goalsRepo: goalsRepo,
		tasksvc:   tasksvc,
	}
}

func (s *InboxService) ProcessRawText(ctx context.Context, userID, rawText string) (*domain.AISuggestion, error) {
	roles, err := s.rolesRepo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("inbox: fetch roles: %w", err)
	}
	goals, err := s.goalsRepo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("inbox: fetch goals: %w", err)
	}

	sugg, err := s.agent.Extract(ctx, userID, rawText, roles, goals)
	if err != nil {
		return nil, fmt.Errorf("inbox: agent extract: %w", err)
	}

	rec := &domain.AISuggestion{
		ID:         uuid.New().String(),
		UserID:     userID,
		RawText:    rawText,
		Suggestion: *sugg,
		Status:     "pending",
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := s.repo.Create(ctx, rec); err != nil {
		return nil, fmt.Errorf("inbox: persist suggestion: %w", err)
	}
	return rec, nil
}

func (s *InboxService) GetSuggestion(ctx context.Context, userID, id string) (*domain.AISuggestion, error) {
	return s.repo.GetByID(ctx, userID, id)
}

func (s *InboxService) ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error) {
	return s.repo.ListPending(ctx, userID)
}

func (s *InboxService) Accept(ctx context.Context, userID, id string, overrides *domain.TaskSuggestion) (string, error) {
	rec, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return "", err
	}

	// Merge overrides on top of the stored suggestion (edit-in-place).
	sugg := rec.Suggestion
	if overrides != nil {
		if overrides.Title != "" {
			sugg.Title = overrides.Title
		}
		if overrides.Description != "" {
			sugg.Description = overrides.Description
		}
		if overrides.RoleID != "" {
			sugg.RoleID = overrides.RoleID
		}
		if overrides.GoalID != nil {
			sugg.GoalID = overrides.GoalID
		}
		if overrides.TaskType != "" {
			sugg.TaskType = overrides.TaskType
		}
		if overrides.Impact != 0 {
			sugg.Impact = overrides.Impact
		}
		if len(overrides.ContextTags) > 0 {
			sugg.ContextTags = overrides.ContextTags
		}
	}

	tt := taskdomain.TaskType(sugg.TaskType)
	if _, ok := taskdomain.TaskTypeMultiplier[tt]; !ok {
		tt = taskdomain.TaskTypeOneTime
	}
	impact := sugg.Impact
	if impact < 1 || impact > 5 {
		impact = 3
	}

	task, err := s.tasksvc.CreateTask(ctx, tasksports.CreateTaskParams{
		UserID:        userID,
		PrimaryRoleID: sugg.RoleID,
		GoalID:        sugg.GoalID,
		Title:         sugg.Title,
		Description:   sugg.Description,
		TaskType:      tt,
		ContextTags:   sugg.ContextTags,
		Impact:        impact,
	})
	if err != nil {
		return "", fmt.Errorf("inbox: create task: %w", err)
	}

	if err := s.repo.UpdateStatus(ctx, id, "accepted", &task.ID); err != nil {
		return task.ID, fmt.Errorf("inbox: update status: %w", err)
	}
	return task.ID, nil
}

func (s *InboxService) Reject(ctx context.Context, userID, id string) error {
	// verify ownership
	if _, err := s.repo.GetByID(ctx, userID, id); err != nil {
		return err
	}
	return s.repo.UpdateStatus(ctx, id, "rejected", nil)
}
