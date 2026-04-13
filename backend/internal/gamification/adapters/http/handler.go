package gamificationhttp

import (
	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/gamification/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds gamification HTTP handlers.
type Handler struct {
	svc ports.GamificationService
}

// NewHandler creates a new gamification HTTP handler.
func NewHandler(svc ports.GamificationService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches gamification routes to the router.
func RegisterRoutes(router fiber.Router, svc ports.GamificationService) {
	h := NewHandler(svc)
	router.Get("/gamification/profile", h.GetProfile)
}

// GetProfile returns the gamification profile for the authenticated user.
func (h *Handler) GetProfile(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	profile, err := h.svc.GetProfile(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": profile})
}
