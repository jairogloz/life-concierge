package rankinghttp

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/ranking/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the ranking engine.
type Handler struct {
	svc ports.RankingService
}

// NewHandler creates a new ranking HTTP handler.
func NewHandler(svc ports.RankingService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all ranking routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.RankingService) {
	h := NewHandler(svc)
	router.Get("/tasks/ranked", h.GetRankedTasks)
	router.Get("/roles/:id/tasks/ranked", h.GetRankedTasksByRole)
}

func (h *Handler) GetRankedTasks(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	limit := parseLimit(c.Query("limit", "10"))
	filter := ports.RankFilter{
		Context: c.Query("context"),
		Limit:   limit,
	}
	tasks, err := h.svc.GetRankedTasks(c.Context(), userID, filter)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": tasks})
}

func (h *Handler) GetRankedTasksByRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	roleID := c.Params("id")
	limit := parseLimit(c.Query("limit", "10"))
	filter := ports.RankFilter{
		Context: c.Query("context"),
		Limit:   limit,
		RoleID:  roleID,
	}
	tasks, err := h.svc.GetRankedTasks(c.Context(), userID, filter)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": tasks})
}

func parseLimit(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil || n < 0 {
		return 10
	}
	return n
}
