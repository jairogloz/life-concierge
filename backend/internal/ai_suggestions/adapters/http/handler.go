package inboxhttp

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the AI inbox.
type Handler struct {
	svc ports.InboxService
}

// NewHandler creates a new AI inbox HTTP handler.
func NewHandler(svc ports.InboxService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all inbox routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.InboxService) {
	h := NewHandler(svc)
	router.Post("/tasks/inbox", h.ProcessRawText)
	router.Get("/tasks/inbox", h.ListPending)
	router.Post("/tasks/inbox/:id/accept", h.Accept)
	router.Post("/tasks/inbox/:id/reject", h.Reject)
}

type inboxRequest struct {
	RawText string `json:"raw_text"`
}

func (h *Handler) ProcessRawText(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req inboxRequest
	if err := c.BodyParser(&req); err != nil || req.RawText == "" {
		return response.BadRequest(c, "raw_text is required")
	}
	suggestion, err := h.svc.ProcessRawText(c.Context(), userID, req.RawText)
	if err != nil {
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(suggestion)
}

func (h *Handler) ListPending(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	suggestions, err := h.svc.ListPending(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": suggestions})
}

func (h *Handler) Accept(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	taskID, err := h.svc.Accept(c.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrSuggestionNotFound) {
			return response.NotFound(c, "suggestion not found")
		}
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"task_id": taskID})
}

func (h *Handler) Reject(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	if err := h.svc.Reject(c.Context(), userID, id); err != nil {
		if errors.Is(err, domain.ErrSuggestionNotFound) {
			return response.NotFound(c, "suggestion not found")
		}
		return response.InternalError(c)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
