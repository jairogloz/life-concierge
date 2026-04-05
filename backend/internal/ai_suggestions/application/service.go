package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
	tasksports "github.com/jairogloz/life-concierge/internal/tasks/ports"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// InboxService orchestrates the AI inbox.
type InboxService struct {
	repo       ports.SuggestionRepository
	agent      ports.TaskAgent
	rolesRepo  RoleReader
	goalsRepo  GoalReader
	tasksvc    tasksports.TaskService
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

func (s *InboxService) Accept(ctx context.Context, userID, id string) (string, error) {
	rec, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return "", err
	}

	ct := taskdomain.CommitmentType(rec.Suggestion.CommitmentType)
	if _, ok := taskdomain.CommitmentMultiplier[ct]; !ok {
		ct = taskdomain.CommitmentTypeIntention
	}
	urgency := rec.Suggestion.Urgency
	if urgency < 1 || urgency > 10 {
		urgency = 5.0
	}

	task, err := s.tasksvc.CreateTask(ctx, tasksports.CreateTaskParams{
		UserID:         userID,
		PrimaryRoleID:  rec.Suggestion.RoleID,
		GoalID:         rec.Suggestion.GoalID,
		Title:          rec.Suggestion.Title,
		Description:    rec.Suggestion.Description,
		CommitmentType: ct,
		ContextTags:    rec.Suggestion.ContextTags,
		Urgency:        urgency,
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
