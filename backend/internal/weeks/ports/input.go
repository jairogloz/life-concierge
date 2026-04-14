package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/weeks/domain"
)

type CreateWeekParams struct {
	UserID   string
	StartsOn *time.Time
}

type UpsertAllocationParams struct {
	UserID          string
	WeekID          string
	TaskID          string
	DayOfWeek       int
	Lane            domain.AllocationLane
	SlotMinuteOfDay *int
}

type ReviewActionParams struct {
	UserID   string
	WeekID   string
	TaskIDs  []string
	Action   domain.ReviewAction
	ToWeekID *string
}

type WeeksService interface {
	ListWeeks(ctx context.Context, userID, status string) ([]*domain.Week, error)
	CreateWeek(ctx context.Context, params CreateWeekParams) (*domain.Week, error)
	GetWeek(ctx context.Context, userID, weekID string) (*domain.Week, error)
	StartWeek(ctx context.Context, userID, weekID string) (*domain.Week, error)
	EnterReview(ctx context.Context, userID, weekID string) (*domain.Week, error)
	ReopenWeek(ctx context.Context, userID, weekID string) (*domain.Week, error)
	CloseWeek(ctx context.Context, userID, weekID string) (*domain.Week, *domain.Week, error)

	ListPriorities(ctx context.Context, userID, weekID string) ([]*domain.WeekPriority, error)
	AddPriority(ctx context.Context, userID, weekID, text string, orderIndex int) (*domain.WeekPriority, error)
	DeletePriority(ctx context.Context, userID, weekID, priorityID string) error

	ListAllocations(ctx context.Context, userID, weekID string) ([]*domain.TaskAllocation, error)
	UpsertAllocation(ctx context.Context, params UpsertAllocationParams) (*domain.TaskAllocation, error)
	DeleteAllocation(ctx context.Context, userID, weekID, allocationID string) error

	ApplyReviewAction(ctx context.Context, params ReviewActionParams) error
	GetBalanceSnapshot(ctx context.Context, userID, weekID string) (*domain.WeekBalanceSnapshot, error)
}
