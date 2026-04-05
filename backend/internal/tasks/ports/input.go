package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/tasks/domain"
)

// CreateTaskParams holds the parameters for creating a task.
type CreateTaskParams struct {
	UserID          string
	PrimaryRoleID   string
	GoalID          *string
	Title           string
	Description     string
	CommitmentType  domain.CommitmentType
	ContextTags     []string
	Urgency         float64
	Deadline        *time.Time
	IsRecurring     bool
	RecurrenceRule  *string
	SecondaryRoles  []string
}

// UpdateTaskParams holds the parameters for updating a task.
// Pointer fields allow partial updates (nil means no change).
type UpdateTaskParams struct {
	Title          *string
	Description    *string
	CommitmentType *domain.CommitmentType
	ContextTags    []string
	Urgency        *float64
	Deadline       *time.Time
	ClearDeadline  bool
	IsRecurring    *bool
	RecurrenceRule *string
	Status         *string
	SecondaryRoles []string
}

// TaskFilter filters tasks in list operations.
type TaskFilter struct {
	RoleID  string
	GoalID  string
	Status  string
	Context string
}

// TaskService defines the input port for the tasks domain.
type TaskService interface {
	CreateTask(ctx context.Context, params CreateTaskParams) (*domain.Task, error)
	GetTask(ctx context.Context, userID, id string) (*domain.Task, error)
	ListTasks(ctx context.Context, userID string, filter TaskFilter) ([]*domain.Task, error)
	UpdateTask(ctx context.Context, userID, id string, params UpdateTaskParams) (*domain.Task, error)
	DeleteTask(ctx context.Context, userID, id string) error
	CompleteTask(ctx context.Context, userID, id string) (*domain.Task, error)
}
