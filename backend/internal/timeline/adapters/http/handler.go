package timelinehttp

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
	"github.com/jairogloz/life-concierge/internal/timeline/domain"
	"github.com/jairogloz/life-concierge/internal/timeline/ports"
)

// Handler holds HTTP handlers for the timeline domain.
type Handler struct {
	svc ports.TimelineService
}

// NewHandler creates a new timeline Handler.
func NewHandler(svc ports.TimelineService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches timeline routes to the given Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.TimelineService) {
	h := NewHandler(svc)
	router.Get("/timeline", h.ListEvents)
}

// ListEvents handles GET /timeline.
// Query params: limit (default 20), offset (default 0).
func (h *Handler) ListEvents(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	events, total, err := h.svc.ListEvents(c.Context(), ports.ListEventsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return response.InternalError(c)
	}
	if events == nil {
		events = []*domain.TimelineEvent{}
	}
	return c.JSON(fiber.Map{
		"data":   events,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
