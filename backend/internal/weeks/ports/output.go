package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/weeks/domain"
)

type WeeksRepository interface {
	ListWeeks(ctx context.Context, userID, status string) ([]*domain.Week, error)
	InsertWeek(ctx context.Context, week *domain.Week) error
	GetWeek(ctx context.Context, userID, weekID string) (*domain.Week, error)
	UpdateWeekStatus(ctx context.Context, userID, weekID string, from []domain.WeekStatus, to domain.WeekStatus, now time.Time) (*domain.Week, error)
	CloseWeekAndCreateNextPlanning(ctx context.Context, userID, weekID string, now time.Time) (*domain.Week, *domain.Week, error)

	ListPriorities(ctx context.Context, userID, weekID string) ([]*domain.WeekPriority, error)
	InsertPriority(ctx context.Context, priority *domain.WeekPriority) error
	DeletePriority(ctx context.Context, userID, weekID, priorityID string) error

	ListAllocations(ctx context.Context, userID, weekID string) ([]*domain.TaskAllocation, error)
	UpsertAllocation(ctx context.Context, allocation *domain.TaskAllocation) error
	DeleteAllocation(ctx context.Context, userID, weekID, allocationID string) error

	ApplyReviewAction(ctx context.Context, params domain.ReviewAction, userID, weekID string, taskIDs []string, now time.Time, explicitToWeekID *string) error
	GetBalanceSnapshot(ctx context.Context, userID, weekID string) (*domain.WeekBalanceSnapshot, error)
}
