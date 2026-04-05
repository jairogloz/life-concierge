package roleshttp

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/roles/domain"
	"github.com/jairogloz/life-concierge/internal/roles/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the roles domain.
type Handler struct {
	svc ports.RoleService
}

// NewHandler creates a new roles HTTP handler.
func NewHandler(svc ports.RoleService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all role routes to the provided Fiber router.
// All routes expect an authenticated request (RequireAuth middleware must be
// applied on the parent group).
func RegisterRoutes(router fiber.Router, svc ports.RoleService) {
	h := NewHandler(svc)
	router.Post("/roles", h.CreateRole)
	router.Get("/roles", h.ListRoles)
	router.Get("/roles/:id", h.GetRole)
	router.Put("/roles/:id", h.UpdateRole)
	router.Delete("/roles/:id", h.DeleteRole)
}

// ── Request / Response types ──────────────────────────────────────────────────

type createRoleRequest struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
	Color  string  `json:"color"`
}

type updateRoleRequest struct {
	Name   *string  `json:"name"`
	Weight *float64 `json:"weight"`
	Color  *string  `json:"color"`
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	role, err := h.svc.CreateRole(c.Context(), ports.CreateRoleParams{
		UserID: userID,
		Name:   req.Name,
		Weight: req.Weight,
		Color:  req.Color,
	})
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(role)
}

func (h *Handler) ListRoles(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	roles, err := h.svc.ListRoles(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(fiber.Map{"data": roles})
}

func (h *Handler) GetRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	role, err := h.svc.GetRole(c.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrRoleNotFound) {
			return response.NotFound(c, "role not found")
		}
		return response.InternalError(c)
	}
	return c.JSON(role)
}

func (h *Handler) UpdateRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	var req updateRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	role, err := h.svc.UpdateRole(c.Context(), userID, id, ports.UpdateRoleParams{
		Name:   req.Name,
		Weight: req.Weight,
		Color:  req.Color,
	})
	if err != nil {
		if errors.Is(err, domain.ErrRoleNotFound) {
			return response.NotFound(c, "role not found")
		}
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.JSON(role)
}

func (h *Handler) DeleteRole(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")
	if err := h.svc.DeleteRole(c.Context(), userID, id); err != nil {
		if errors.Is(err, domain.ErrRoleNotFound) {
			return response.NotFound(c, "role not found")
		}
		return response.InternalError(c)
	}
	return c.SendStatus(fiber.StatusNoContent)
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
