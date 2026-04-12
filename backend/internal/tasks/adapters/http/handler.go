package taskshttp

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
	"github.com/jairogloz/life-concierge/internal/tasks/domain"
	"github.com/jairogloz/life-concierge/internal/tasks/ports"
)

// Handler holds the HTTP handlers for the tasks domain.
type Handler struct {
	svc ports.TaskService
}

// NewHandler creates a new tasks HTTP handler.
func NewHandler(svc ports.TaskService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all task routes to the provided Fiber router.
// NOTE: /tasks/tags MUST be registered before /tasks/:id to avoid param capture.
func RegisterRoutes(router fiber.Router, svc ports.TaskService) {
	h := NewHandler(svc)
	router.Post("/tasks", h.CreateTask)
	router.Get("/tasks", h.ListTasks)
	router.Get("/tasks/tags", h.GetTags)
	router.Get("/tasks/:id", h.GetTask)
	router.Put("/tasks/:id", h.UpdateTask)
	router.Delete("/tasks/:id", h.DeleteTask)
	router.Patch("/tasks/:id/complete", h.CompleteTask)
}

// ── Request types ─────────────────────────────────────────────────────────────

type createTaskRequest struct {
	PrimaryRoleID    string           `json:"primary_role_id"`
	GoalID           *string          `json:"goal_id"`
	Title            string           `json:"title"`
	Description      string           `json:"description"`
	TaskType         domain.TaskType  `json:"task_type"`
	ContextTags      []string         `json:"context_tags"`
	Impact           int              `json:"impact"`
	Deadline         *time.Time       `json:"deadline"`
	SoftDeadline     *time.Time       `json:"soft_deadline"`
	ScheduledDate    *time.Time       `json:"scheduled_date"`
	Effort           int              `json:"effort"`
	EstimatedMinutes *int             `json:"estimated_minutes"`
	IsRecurring      bool             `json:"is_recurring"`
	RecurrenceRule   *string          `json:"recurrence_rule"`
	SecondaryRoles   []string         `json:"secondary_role_ids"`
}

type updateTaskRequest struct {
	Title              *string          `json:"title"`
	Description        *string          `json:"description"`
	TaskType           *domain.TaskType `json:"task_type"`
	ContextTags        []string         `json:"context_tags"`
	Impact             *int             `json:"impact"`
	Deadline           *time.Time       `json:"deadline"`
	ClearDeadline      bool             `json:"clear_deadline"`
	SoftDeadline       *time.Time       `json:"soft_deadline"`
	ClearSoftDeadline  bool             `json:"clear_soft_deadline"`
	ScheduledDate      *time.Time       `json:"scheduled_date"`
	ClearScheduledDate bool             `json:"clear_scheduled_date"`
	Effort             *int             `json:"effort"`
	EstimatedMinutes   *int             `json:"estimated_minutes"`
	IsRecurring        *bool            `json:"is_recurring"`
	RecurrenceRule     *string          `json:"recurrence_rule"`
	Status             *string          `json:"status"`
	SecondaryRoles     []string         `json:"secondary_role_ids"`
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateTask(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	task, err := h.svc.CreateTask(c.Context(), ports.CreateTaskParams{
		UserID:           userID,
		PrimaryRoleID:    req.PrimaryRoleID,
		GoalID:           req.GoalID,
		Title:            req.Title,
		Description:      req.Description,
		TaskType:         req.TaskType,
		ContextTags:      req.ContextTags,
		Impact:           req.Impact,
		Deadline:         req.Deadline,
		SoftDeadline:     req.SoftDeadline,
		ScheduledDate:    req.ScheduledDate,
		Effort:           req.Effort,
		EstimatedMinutes: req.EstimatedMinutes,
		IsRecurring:      req.IsRecurring,
		RecurrenceRule:   req.RecurrenceRule,
		SecondaryRoles:   req.SecondaryRoles,
	})
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(task)
}

func (h *Handler) ListTasks(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	filter := ports.TaskFilter{
		RoleID:        c.Query("role_id"),
		GoalID:        c.Query("goal_id"),
		Status:        c.Query("status"),
		Context:       c.Query("context"),
		ScheduledDate: c.Query("scheduled_date"),
	}
	tasks, err := h.svc.ListTasks(c.Context(), userID, filter)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": tasks})
}

func (h *Handler) GetTask(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	task, err := h.svc.GetTask(c.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrTaskNotFound) {
			return response.NotFound(c, "task not found")
		}
		return response.InternalError(c)
	}
	return c.JSON(task)
}

func (h *Handler) GetTags(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	tags, err := h.svc.GetTaskTags(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": tags})
}

func (h *Handler) UpdateTask(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	var req updateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	task, err := h.svc.UpdateTask(c.Context(), userID, id, ports.UpdateTaskParams{
		Title:              req.Title,
		Description:        req.Description,
		TaskType:           req.TaskType,
		ContextTags:        req.ContextTags,
		Impact:             req.Impact,
		Deadline:           req.Deadline,
		ClearDeadline:      req.ClearDeadline,
		SoftDeadline:       req.SoftDeadline,
		ClearSoftDeadline:  req.ClearSoftDeadline,
		ScheduledDate:      req.ScheduledDate,
		ClearScheduledDate: req.ClearScheduledDate,
		Effort:             req.Effort,
		EstimatedMinutes:   req.EstimatedMinutes,
		IsRecurring:        req.IsRecurring,
		RecurrenceRule:     req.RecurrenceRule,
		Status:             req.Status,
		SecondaryRoles:     req.SecondaryRoles,
	})
	if err != nil {
		if errors.Is(err, domain.ErrTaskNotFound) {
			return response.NotFound(c, "task not found")
		}
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.JSON(task)
}

func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	if err := h.svc.DeleteTask(c.Context(), userID, id); err != nil {
		if errors.Is(err, domain.ErrTaskNotFound) {
			return response.NotFound(c, "task not found")
		}
		return response.InternalError(c)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) CompleteTask(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	task, err := h.svc.CompleteTask(c.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrTaskNotFound) {
			return response.NotFound(c, "task not found")
		}
		return response.InternalError(c)
	}
	return c.JSON(task)
}

// isValidationError returns true for errors that originate from domain validation.
func isValidationError(err error) bool {
	msg := err.Error()
	if len(msg) >= 10 && msg[:10] == "validation" {
		return true
	}
	for _, kw := range []string{"required", "must be", "invalid"} {
		if len(msg) >= len(kw) {
			for i := 0; i <= len(msg)-len(kw); i++ {
				if msg[i:i+len(kw)] == kw {
					return true
				}
			}
		}
	}
	return false
}
