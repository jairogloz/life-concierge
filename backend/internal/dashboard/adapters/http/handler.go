package dashboardhttp

import (
	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/dashboard/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds HTTP handlers for the dashboard.
type Handler struct {
	svc ports.DashboardService
}

// NewHandler creates a new dashboard HTTP handler.
func NewHandler(svc ports.DashboardService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all dashboard routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.DashboardService) {
	h := NewHandler(svc)
	router.Get("/dashboard/today", h.GetTodaySummary)
}

// GetTodaySummary returns the combined today dashboard.
func (h *Handler) GetTodaySummary(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	summary, err := h.svc.GetTodaySummary(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": summary})
}
