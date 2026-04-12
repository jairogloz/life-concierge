package inboxhttp_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	inboxhttp "github.com/jairogloz/life-concierge/internal/ai_suggestions/adapters/http"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
)

// ── Mock service ──────────────────────────────────────────────────────────────

type mockInboxSvc struct {
	processFn func(ctx context.Context, userID, rawText string) (*domain.AISuggestion, error)
	getFn     func(ctx context.Context, userID, id string) (*domain.AISuggestion, error)
	listFn    func(ctx context.Context, userID string) ([]*domain.AISuggestion, error)
	acceptFn  func(ctx context.Context, userID, id string, overrides *domain.TaskSuggestion) (string, error)
	rejectFn  func(ctx context.Context, userID, id string) error
}

func (m *mockInboxSvc) ProcessRawText(ctx context.Context, userID, rawText string) (*domain.AISuggestion, error) {
	return m.processFn(ctx, userID, rawText)
}
func (m *mockInboxSvc) GetSuggestion(ctx context.Context, userID, id string) (*domain.AISuggestion, error) {
	return m.getFn(ctx, userID, id)
}
func (m *mockInboxSvc) ListPending(ctx context.Context, userID string) ([]*domain.AISuggestion, error) {
	return m.listFn(ctx, userID)
}
func (m *mockInboxSvc) Accept(ctx context.Context, userID, id string, overrides *domain.TaskSuggestion) (string, error) {
	return m.acceptFn(ctx, userID, id, overrides)
}
func (m *mockInboxSvc) Reject(ctx context.Context, userID, id string) error {
	return m.rejectFn(ctx, userID, id)
}

// Ensure mockInboxSvc satisfies ports.InboxService at compile time.
var _ ports.InboxService = (*mockInboxSvc)(nil)

// ── Test helpers ──────────────────────────────────────────────────────────────

// newTestApp builds a bare Fiber app with a stub auth middleware and the inbox routes.
// This bypasses Clerk entirely — suitable for handler-level tests.
func newTestApp(svc ports.InboxService) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: func(c *fiber.Ctx, err error) error {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}})
	// Stub auth: inject a fixed user_id so middleware.GetUserID works.
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("authenticated_user_id", "test-user-id")
		return c.Next()
	})
	inboxhttp.RegisterRoutes(app, svc)
	return app
}

func doRequest(t *testing.T, app *fiber.App, method, path string, body interface{}) *http.Response {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		bodyReader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	return resp
}

func fakeSuggestion(id string) *domain.AISuggestion {
	return &domain.AISuggestion{
		ID:     id,
		UserID: "test-user-id",
		Suggestion: domain.TaskSuggestion{
			Title:    "Call mom",
			TaskType: "one_time",
			RoleID:   "role-1",
			Impact:   3,
		},
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ── POST /tasks/inbox ─────────────────────────────────────────────────────────

func TestProcessRawText_201(t *testing.T) {
	svc := &mockInboxSvc{
		processFn: func(_ context.Context, userID, rawText string) (*domain.AISuggestion, error) {
			assert.Equal(t, "test-user-id", userID)
			assert.Equal(t, "Call mom this Sunday", rawText)
			return fakeSuggestion("s-1"), nil
		},
	}

	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox", map[string]string{"raw_text": "Call mom this Sunday"})
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var body domain.AISuggestion
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "s-1", body.ID)
}

func TestProcessRawText_400_EmptyRawText(t *testing.T) {
	svc := &mockInboxSvc{}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox", map[string]string{"raw_text": ""})
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestProcessRawText_400_MissingBody(t *testing.T) {
	svc := &mockInboxSvc{}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox", nil)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestProcessRawText_500_ServiceError(t *testing.T) {
	svc := &mockInboxSvc{
		processFn: func(_ context.Context, _, _ string) (*domain.AISuggestion, error) {
			return nil, errors.New("openai down")
		},
	}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox", map[string]string{"raw_text": "some text"})
	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
}

// ── GET /tasks/inbox ──────────────────────────────────────────────────────────

func TestListPending_200(t *testing.T) {
	svc := &mockInboxSvc{
		listFn: func(_ context.Context, userID string) ([]*domain.AISuggestion, error) {
			assert.Equal(t, "test-user-id", userID)
			return []*domain.AISuggestion{fakeSuggestion("s-1"), fakeSuggestion("s-2")}, nil
		},
	}

	resp := doRequest(t, newTestApp(svc), "GET", "/tasks/inbox", nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Data []*domain.AISuggestion `json:"data"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Len(t, body.Data, 2)
}

func TestListPending_200_Empty(t *testing.T) {
	svc := &mockInboxSvc{
		listFn: func(_ context.Context, _ string) ([]*domain.AISuggestion, error) {
			return nil, nil
		},
	}

	resp := doRequest(t, newTestApp(svc), "GET", "/tasks/inbox", nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// ── POST /tasks/inbox/:id/accept ──────────────────────────────────────────────

func TestAccept_200(t *testing.T) {
	svc := &mockInboxSvc{
		acceptFn: func(_ context.Context, userID, id string, _ *domain.TaskSuggestion) (string, error) {
			assert.Equal(t, "test-user-id", userID)
			assert.Equal(t, "sugg-1", id)
			return "task-xyz", nil
		},
	}

	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox/sugg-1/accept", nil)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "task-xyz", body["task_id"])
}

func TestAccept_404(t *testing.T) {
	svc := &mockInboxSvc{
		acceptFn: func(_ context.Context, _, _ string, _ *domain.TaskSuggestion) (string, error) {
			return "", domain.ErrSuggestionNotFound
		},
	}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox/missing/accept", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// ── POST /tasks/inbox/:id/reject ──────────────────────────────────────────────

func TestReject_204(t *testing.T) {
	svc := &mockInboxSvc{
		rejectFn: func(_ context.Context, userID, id string) error {
			assert.Equal(t, "test-user-id", userID)
			assert.Equal(t, "sugg-2", id)
			return nil
		},
	}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox/sugg-2/reject", nil)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
}

func TestReject_404(t *testing.T) {
	svc := &mockInboxSvc{
		rejectFn: func(_ context.Context, _, _ string) error {
			return domain.ErrSuggestionNotFound
		},
	}
	resp := doRequest(t, newTestApp(svc), "POST", "/tasks/inbox/missing/reject", nil)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
