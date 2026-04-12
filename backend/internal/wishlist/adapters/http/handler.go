package wishlhttp

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
	"github.com/jairogloz/life-concierge/internal/wishlist/ports"
)

// Handler holds the HTTP handlers for the wishlist domain.
type Handler struct {
	svc ports.WishlistService
}

// NewHandler creates a new wishlist HTTP handler.
func NewHandler(svc ports.WishlistService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all wishlist routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.WishlistService) {
	h := NewHandler(svc)
	router.Post("/wishlist", h.CreateItem)
	router.Get("/wishlist", h.ListItems)
	router.Get("/wishlist/ranked", h.RankItems)
	router.Post("/wishlist/:id/mark-bought", h.MarkBought)
	router.Post("/wishlist/:id/evaluate", h.EvaluateItem)
}

type createItemRequest struct {
	Title        string  `json:"title"`
	Price        float64 `json:"price"`
	Currency     string  `json:"currency"`
	RoleID       *string `json:"role_id"`
	GoalID       *string `json:"goal_id"`
	Impact       int     `json:"impact"`
	CooldownDays int     `json:"cooldown_days"`
}

// CreateItem handles POST /wishlist.
func (h *Handler) CreateItem(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	params := ports.CreateItemParams{
		UserID:       userID,
		Title:        req.Title,
		Price:        req.Price,
		Currency:     req.Currency,
		RoleID:       req.RoleID,
		GoalID:       req.GoalID,
		Impact:       req.Impact,
		CooldownDays: req.CooldownDays,
	}

	item, err := h.svc.CreateItem(c.Context(), params)
	if err != nil {
		if strings.HasPrefix(err.Error(), "validation:") {
			return response.Error(c, fiber.StatusUnprocessableEntity, "validation_error", err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// ListItems handles GET /wishlist.
func (h *Handler) ListItems(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	includeBought := c.QueryBool("include_bought", false)

	items, err := h.svc.ListItems(c.Context(), userID, includeBought)
	if err != nil {
		return response.InternalError(c)
	}
	if items == nil {
		items = []*domain.WishlistItem{}
	}
	return c.JSON(fiber.Map{"data": items})
}

// RankItems handles GET /wishlist/ranked.
func (h *Handler) RankItems(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	ranked, err := h.svc.RankItems(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	if ranked == nil {
		ranked = []*domain.RankedItem{}
	}
	return c.JSON(fiber.Map{"data": ranked})
}

// MarkBought handles POST /wishlist/:id/mark-bought.
func (h *Handler) MarkBought(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	itemID := c.Params("id")

	item, err := h.svc.MarkBought(c.Context(), userID, itemID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response.NotFound(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.JSON(item)
}

// EvaluateItem handles POST /wishlist/:id/evaluate.
func (h *Handler) EvaluateItem(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	itemID := c.Params("id")

	item, err := h.svc.EvaluateItem(c.Context(), userID, itemID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response.NotFound(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.JSON(item)
}
