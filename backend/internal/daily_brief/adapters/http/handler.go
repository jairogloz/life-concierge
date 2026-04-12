package briefhttp

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jairogloz/life-concierge/internal/daily_brief/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds HTTP handlers for the daily brief.
type Handler struct {
	svc ports.DailyBriefService
}

// NewHandler creates a new brief Handler.
func NewHandler(svc ports.DailyBriefService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches the daily brief route to the given Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.DailyBriefService) {
	h := NewHandler(svc)
	router.Get("/ai/daily-brief", h.GetDailyBrief)
}

// GetDailyBrief handles GET /ai/daily-brief.
func (h *Handler) GetDailyBrief(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	brief, err := h.svc.GetDailyBrief(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(brief)
}
