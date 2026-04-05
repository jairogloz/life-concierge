package goalshttp

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/goals/domain"
	"github.com/jairogloz/life-concierge/internal/goals/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the goals domain.
type Handler struct {
	svc ports.GoalService
}

// NewHandler creates a new goals HTTP handler.
func NewHandler(svc ports.GoalService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all goal routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.GoalService) {
	h := NewHandler(svc)
	router.Post("/goals", h.CreateGoal)
	router.Get("/goals", h.ListGoals)
	router.Get("/goals/:id", h.GetGoal)
	router.Put("/goals/:id", h.UpdateGoal)
	router.Delete("/goals/:id", h.DeleteGoal)
	router.Get("/roles/:roleId/goals", h.ListGoalsByRole)
}

// ── Request types ─────────────────────────────────────────────────────────────

type createGoalRequest struct {
	RoleID       string     `json:"role_id"`
	ParentGoalID *string    `json:"parent_goal_id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Weight       float64    `json:"weight"`
	Deadline     *time.Time `json:"deadline"`
}

type updateGoalRequest struct {
	Title         *string    `json:"title"`
	Description   *string    `json:"description"`
	Weight        *float64   `json:"weight"`
	Status        *string    `json:"status"`
	Deadline      *time.Time `json:"deadline"`
	ClearDeadline bool       `json:"clear_deadline"`
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateGoal(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	goal, err := h.svc.CreateGoal(c.Context(), ports.CreateGoalParams{
		UserID:       userID,
		RoleID:       req.RoleID,
		ParentGoalID: req.ParentGoalID,
		Title:        req.Title,
		Description:  req.Description,
		Weight:       req.Weight,
		Deadline:     req.Deadline,
	})
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(goal)
}

func (h *Handler) ListGoals(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	goals, err := h.svc.ListGoals(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": goals})
}

func (h *Handler) GetGoal(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	goal, err := h.svc.GetGoal(c.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrGoalNotFound) {
			return response.NotFound(c, "goal not found")
		}
		return response.InternalError(c)
	}
	return c.JSON(goal)
}

func (h *Handler) UpdateGoal(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	var req updateGoalRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	goal, err := h.svc.UpdateGoal(c.Context(), userID, id, ports.UpdateGoalParams{
		Title:         req.Title,
		Description:   req.Description,
		Weight:        req.Weight,
		Status:        req.Status,
		Deadline:      req.Deadline,
		ClearDeadline: req.ClearDeadline,
	})
	if err != nil {
		if errors.Is(err, domain.ErrGoalNotFound) {
			return response.NotFound(c, "goal not found")
		}
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.JSON(goal)
}

func (h *Handler) DeleteGoal(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	if err := h.svc.DeleteGoal(c.Context(), userID, id); err != nil {
		if errors.Is(err, domain.ErrGoalNotFound) {
			return response.NotFound(c, "goal not found")
		}
		return response.InternalError(c)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListGoalsByRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	roleID := c.Params("roleId")
	goals, err := h.svc.ListGoalsByRole(c.Context(), userID, roleID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": goals})
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
