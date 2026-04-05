package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/application"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
	taskdomain "github.com/jairogloz/life-concierge/internal/tasks/domain"
	tasksports "github.com/jairogloz/life-concierge/internal/tasks/ports"
)

// ── Manual mocks ─────────────────────────────────────────────────────────────

type mockRepo struct {
	createFn       func(ctx context.Context, s *domain.AISuggestion) error
	getByIDFn      func(ctx context.Context, userID, id string) (*domain.AISuggestion, error)
	listPendingFn  func(ctx context.Context, userID string) ([]*domain.AISuggestion, error)
	updateStatusFn func(ctx context.Context, id, status string, taskID *string) error
}

func (m *mockRepo) Create(ctx context.Context, s *domain.AISuggestion) error {
	return m.createFn(ctx, s)
}
func (m *mockRepo) GetByID(ctx context.Context, userID, id string) (*domain.AISuggestion, error) {
	return m.getByIDFn(ctx, userID, id)
}
func (m *mockRepo) ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error) {
	return m.listPendingFn(ctx, userID)
}
func (m *mockRepo) UpdateStatus(ctx context.Context, id, status string, taskID *string) error {
	return m.updateStatusFn(ctx, id, status, taskID)
}

type mockAgent struct {
	extractFn func(ctx context.Context, userID, rawText string, roles []ports.RoleContext, goals []ports.GoalContext) (*domain.TaskSuggestion, error)
}

func (m *mockAgent) Extract(ctx context.Context, userID, rawText string, roles []ports.RoleContext, goals []ports.GoalContext) (*domain.TaskSuggestion, error) {
	return m.extractFn(ctx, userID, rawText, roles, goals)
}

type mockRolesReader struct {
	listFn func(ctx context.Context, userID string) ([]ports.RoleContext, error)
}

func (m *mockRolesReader) List(ctx context.Context, userID string) ([]ports.RoleContext, error) {
	return m.listFn(ctx, userID)
}

type mockGoalsReader struct {
	listFn func(ctx context.Context, userID string) ([]ports.GoalContext, error)
}

func (m *mockGoalsReader) List(ctx context.Context, userID string) ([]ports.GoalContext, error) {
	return m.listFn(ctx, userID)
}

type mockTaskSvc struct {
	createFn func(ctx context.Context, params tasksports.CreateTaskParams) (*taskdomain.Task, error)
}

func (m *mockTaskSvc) CreateTask(ctx context.Context, params tasksports.CreateTaskParams) (*taskdomain.Task, error) {
	return m.createFn(ctx, params)
}
func (m *mockTaskSvc) GetTask(ctx context.Context, userID, id string) (*taskdomain.Task, error) {
	return nil, nil
}
func (m *mockTaskSvc) ListTasks(ctx context.Context, userID string, filter tasksports.TaskFilter) ([]*taskdomain.Task, error) {
	return nil, nil
}
func (m *mockTaskSvc) UpdateTask(ctx context.Context, userID, id string, params tasksports.UpdateTaskParams) (*taskdomain.Task, error) {
	return nil, nil
}
func (m *mockTaskSvc) DeleteTask(ctx context.Context, userID, id string) error { return nil }
func (m *mockTaskSvc) CompleteTask(ctx context.Context, userID, id string) (*taskdomain.Task, error) {
	return nil, nil
}

// ── helpers ───────────────────────────────────────────────────────────────────

func noopRoles() *mockRolesReader {
	return &mockRolesReader{listFn: func(_ context.Context, _ string) ([]ports.RoleContext, error) {
		return []ports.RoleContext{{ID: "role-1", Name: "Work"}}, nil
	}}
}

func noopGoals() *mockGoalsReader {
	return &mockGoalsReader{listFn: func(_ context.Context, _ string) ([]ports.GoalContext, error) {
		return []ports.GoalContext{{ID: "goal-1", Title: "Ship v1", RoleID: "role-1"}}, nil
	}}
}

func fakeSuggestion(id string) *domain.AISuggestion {
	return &domain.AISuggestion{
		ID:     id,
		UserID: "user-1",
		Suggestion: domain.TaskSuggestion{
			Title:          "Call mom",
			CommitmentType: "commitment",
			RoleID:         "role-1",
			Urgency:        7.0,
		},
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func TestProcessRawText_Success(t *testing.T) {
	ctx := context.Background()

	agent := &mockAgent{
		extractFn: func(_ context.Context, _, _ string, _ []ports.RoleContext, _ []ports.GoalContext) (*domain.TaskSuggestion, error) {
			return &domain.TaskSuggestion{Title: "Call mom", Urgency: 7, CommitmentType: "commitment", RoleID: "role-1"}, nil
		},
	}
	repo := &mockRepo{
		createFn: func(_ context.Context, s *domain.AISuggestion) error {
			assert.Equal(t, "user-1", s.UserID)
			assert.Equal(t, "raw input", s.RawText)
			assert.Equal(t, "pending", s.Status)
			return nil
		},
	}

	svc := application.NewInboxService(repo, agent, noopRoles(), noopGoals(), nil)
	rec, err := svc.ProcessRawText(ctx, "user-1", "raw input")

	require.NoError(t, err)
	assert.Equal(t, "Call mom", rec.Suggestion.Title)
	assert.Equal(t, "pending", rec.Status)
	assert.NotEmpty(t, rec.ID)
}

func TestProcessRawText_AgentError(t *testing.T) {
	agent := &mockAgent{
		extractFn: func(_ context.Context, _, _ string, _ []ports.RoleContext, _ []ports.GoalContext) (*domain.TaskSuggestion, error) {
			return nil, errors.New("openai unavailable")
		},
	}
	repo := &mockRepo{createFn: func(_ context.Context, _ *domain.AISuggestion) error { return nil }}

	svc := application.NewInboxService(repo, agent, noopRoles(), noopGoals(), nil)
	_, err := svc.ProcessRawText(context.Background(), "user-1", "raw input")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "openai unavailable")
}

func TestProcessRawText_RepoError(t *testing.T) {
	agent := &mockAgent{
		extractFn: func(_ context.Context, _, _ string, _ []ports.RoleContext, _ []ports.GoalContext) (*domain.TaskSuggestion, error) {
			return &domain.TaskSuggestion{Title: "t", Urgency: 5, CommitmentType: "intention", RoleID: "r"}, nil
		},
	}
	repo := &mockRepo{
		createFn: func(_ context.Context, _ *domain.AISuggestion) error {
			return errors.New("db error")
		},
	}

	svc := application.NewInboxService(repo, agent, noopRoles(), noopGoals(), nil)
	_, err := svc.ProcessRawText(context.Background(), "user-1", "raw input")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "db error")
}

func TestAccept_Success(t *testing.T) {
	sugg := fakeSuggestion("sugg-1")
	createdTask := &taskdomain.Task{ID: "task-abc"}
	var capturedStatus string
	var capturedTaskID *string

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*domain.AISuggestion, error) { return sugg, nil },
		updateStatusFn: func(_ context.Context, _, status string, taskID *string) error {
			capturedStatus = status
			capturedTaskID = taskID
			return nil
		},
	}
	tasksvc := &mockTaskSvc{
		createFn: func(_ context.Context, _ tasksports.CreateTaskParams) (*taskdomain.Task, error) {
			return createdTask, nil
		},
	}

	svc := application.NewInboxService(repo, nil, noopRoles(), noopGoals(), tasksvc)
	taskID, err := svc.Accept(context.Background(), "user-1", "sugg-1")

	require.NoError(t, err)
	assert.Equal(t, "task-abc", taskID)
	assert.Equal(t, "accepted", capturedStatus)
	require.NotNil(t, capturedTaskID)
	assert.Equal(t, "task-abc", *capturedTaskID)
}

func TestAccept_NotFound(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*domain.AISuggestion, error) {
			return nil, domain.ErrSuggestionNotFound
		},
	}

	svc := application.NewInboxService(repo, nil, noopRoles(), noopGoals(), nil)
	_, err := svc.Accept(context.Background(), "user-1", "missing")

	require.ErrorIs(t, err, domain.ErrSuggestionNotFound)
}

func TestReject_Success(t *testing.T) {
	sugg := fakeSuggestion("sugg-2")
	var capturedStatus string

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*domain.AISuggestion, error) { return sugg, nil },
		updateStatusFn: func(_ context.Context, _, status string, _ *string) error {
			capturedStatus = status
			return nil
		},
	}

	svc := application.NewInboxService(repo, nil, noopRoles(), noopGoals(), nil)
	err := svc.Reject(context.Background(), "user-1", "sugg-2")

	require.NoError(t, err)
	assert.Equal(t, "rejected", capturedStatus)
}

func TestReject_NotFound(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (*domain.AISuggestion, error) {
			return nil, domain.ErrSuggestionNotFound
		},
	}

	svc := application.NewInboxService(repo, nil, noopRoles(), noopGoals(), nil)
	err := svc.Reject(context.Background(), "user-1", "missing")

	require.ErrorIs(t, err, domain.ErrSuggestionNotFound)
}

func TestListPending(t *testing.T) {
	expected := []*domain.AISuggestion{fakeSuggestion("s1"), fakeSuggestion("s2")}
	repo := &mockRepo{
		listPendingFn: func(_ context.Context, userID string) ([]*domain.AISuggestion, error) {
			assert.Equal(t, "user-1", userID)
			return expected, nil
		},
	}

	svc := application.NewInboxService(repo, nil, noopRoles(), noopGoals(), nil)
	result, err := svc.ListPending(context.Background(), "user-1")

	require.NoError(t, err)
	assert.Len(t, result, 2)
}
