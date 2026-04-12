package balancehttp

import (
	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/balance/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the life balance system.
type Handler struct {
	svc ports.BalanceService
}

// NewHandler creates a new balance HTTP handler.
func NewHandler(svc ports.BalanceService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all balance routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.BalanceService) {
	h := NewHandler(svc)
	router.Get("/roles/balance", h.GetBalance)
}

// GetBalance returns the life balance score for each of the user's roles.
func (h *Handler) GetBalance(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	summary, err := h.svc.GetRoleBalanceSummary(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": summary})
}
