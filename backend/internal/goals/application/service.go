package application

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/goals/domain"
	"github.com/jairogloz/life-concierge/internal/goals/ports"
)

// GoalService implements ports.GoalService.
type GoalService struct {
	repo ports.GoalRepository
}

// NewGoalService creates a new GoalService.
func NewGoalService(repo ports.GoalRepository) *GoalService {
	return &GoalService{repo: repo}
}

func (s *GoalService) CreateGoal(ctx context.Context, params ports.CreateGoalParams) (*domain.Goal, error) {
	goal := &domain.Goal{
		ID:           uuid.New().String(),
		UserID:       params.UserID,
		RoleID:       params.RoleID,
		ParentGoalID: params.ParentGoalID,
		Title:        params.Title,
		Description:  params.Description,
		Weight:       params.Weight,
		Status:       "active",
		Deadline:     params.Deadline,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if goal.Weight == 0 {
		goal.Weight = 1.0
	}
	if err := goal.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, goal); err != nil {
		return nil, fmt.Errorf("create goal: %w", err)
	}
	return goal, nil
}

func (s *GoalService) GetGoal(ctx context.Context, userID, id string) (*domain.Goal, error) {
	return s.repo.GetByID(ctx, userID, id)
}

func (s *GoalService) ListGoals(ctx context.Context, userID string) ([]*domain.Goal, error) {
	goals, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}
	return goals, nil
}

func (s *GoalService) ListGoalsByRole(ctx context.Context, userID, roleID string) ([]*domain.Goal, error) {
	goals, err := s.repo.ListByRole(ctx, userID, roleID)
	if err != nil {
		return nil, fmt.Errorf("list goals by role: %w", err)
	}
	return goals, nil
}

func (s *GoalService) UpdateGoal(ctx context.Context, userID, id string, params ports.UpdateGoalParams) (*domain.Goal, error) {
	goal, err := s.repo.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if params.Title != nil {
		goal.Title = *params.Title
	}
	if params.Description != nil {
		goal.Description = *params.Description
	}
	if params.Weight != nil {
		goal.Weight = *params.Weight
	}
	if params.Status != nil {
		goal.Status = *params.Status
	}
	if params.ClearDeadline {
		goal.Deadline = nil
	} else if params.Deadline != nil {
		goal.Deadline = params.Deadline
	}
	goal.UpdatedAt = time.Now().UTC()
	if err := goal.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Update(ctx, goal); err != nil {
		return nil, fmt.Errorf("update goal: %w", err)
	}
	return goal, nil
}

func (s *GoalService) DeleteGoal(ctx context.Context, userID, id string) error {
	return s.repo.Delete(ctx, userID, id)
}
