package weekshttp

import (
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
	"github.com/jairogloz/life-concierge/internal/weeks/domain"
	"github.com/jairogloz/life-concierge/internal/weeks/ports"
)

type Handler struct {
	svc ports.WeeksService
}

func NewHandler(svc ports.WeeksService) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(router fiber.Router, svc ports.WeeksService) {
	h := NewHandler(svc)
	router.Get("/weeks", h.ListWeeks)
	router.Post("/weeks", h.CreateWeek)
	router.Get("/weeks/:id", h.GetWeek)
	router.Put("/weeks/:id", h.UpdateWeek)

	router.Post("/weeks/:id/start", h.StartWeek)
	router.Post("/weeks/:id/enter-review", h.EnterReview)
	router.Post("/weeks/:id/reopen", h.ReopenWeek)
	router.Post("/weeks/:id/close", h.CloseWeek)

	router.Get("/weeks/:id/priorities", h.ListPriorities)
	router.Post("/weeks/:id/priorities", h.AddPriority)
	router.Delete("/weeks/:id/priorities/:priorityId", h.DeletePriority)

	router.Get("/weeks/:id/allocations", h.ListAllocations)
	router.Post("/weeks/:id/allocations", h.UpsertAllocation)
	router.Delete("/weeks/:id/allocations/:allocationId", h.DeleteAllocation)

	router.Post("/weeks/:id/review/actions", h.ApplyReviewAction)
	router.Get("/weeks/:id/balance", h.GetBalanceSnapshot)
}

type createWeekRequest struct {
	StartsOn *string `json:"starts_on"`
}

type updateWeekRequest struct {
	Status string `json:"status"`
}

type addPriorityRequest struct {
	Text       string `json:"text"`
	OrderIndex int    `json:"order_index"`
}

type upsertAllocationRequest struct {
	TaskID          string  `json:"task_id"`
	DayOfWeek       int     `json:"day_of_week"`
	Lane            string  `json:"lane"`
	SlotMinuteOfDay *int    `json:"slot_minute_of_day"`
	SlotTime        *string `json:"slot_time"`
}

type reviewActionRequest struct {
	Action   string   `json:"action"`
	TaskIDs  []string `json:"task_ids"`
	ToWeekID *string  `json:"to_week_id"`
}

func parseDatePtr(value *string) (*time.Time, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(*value))
	if err != nil {
		return nil, err
	}
	u := parsed.UTC()
	return &u, nil
}

func parseSlotMinute(req upsertAllocationRequest) (*int, error) {
	if req.SlotMinuteOfDay != nil {
		return req.SlotMinuteOfDay, nil
	}
	if req.SlotTime == nil || strings.TrimSpace(*req.SlotTime) == "" {
		return nil, nil
	}
	parts := strings.Split(strings.TrimSpace(*req.SlotTime), ":")
	if len(parts) != 2 {
		return nil, errors.New("slot_time must be HH:MM")
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil {
		return nil, errors.New("slot_time must be HH:MM")
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil, errors.New("slot_time must be HH:MM")
	}
	value := h*60 + m
	return &value, nil
}

func handleWeeksError(c *fiber.Ctx, err error) error {
	if err == nil {
		return nil
	}
	log.Printf("weeks error: %v", err)
	if errors.Is(err, domain.ErrWeekNotFound) {
		return response.NotFound(c, "week not found")
	}
	if errors.Is(err, domain.ErrInvalidTransition) {
		return response.BadRequest(c, "invalid week status transition")
	}
	msg := err.Error()
	if strings.HasPrefix(msg, "validation:") {
		return response.BadRequest(c, msg)
	}
	return response.InternalError(c)
}

func (h *Handler) ListWeeks(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	status := c.Query("status")
	weeks, err := h.svc.ListWeeks(c.Context(), userID, status)
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": weeks})
}

func (h *Handler) CreateWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createWeekRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return response.BadRequest(c, "invalid request body")
		}
	}
	startsOn, err := parseDatePtr(req.StartsOn)
	if err != nil {
		return response.BadRequest(c, "starts_on must be YYYY-MM-DD")
	}
	week, err := h.svc.CreateWeek(c.Context(), ports.CreateWeekParams{UserID: userID, StartsOn: startsOn})
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": week})
}

func (h *Handler) GetWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	week, err := h.svc.GetWeek(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": week})
}

func (h *Handler) UpdateWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	weekID := c.Params("id")
	var req updateWeekRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	status := strings.TrimSpace(req.Status)
	switch status {
	case string(domain.WeekStatusActive):
		week, err := h.svc.StartWeek(c.Context(), userID, weekID)
		if err != nil {
			return handleWeeksError(c, err)
		}
		return c.JSON(fiber.Map{"data": week})
	case string(domain.WeekStatusReview):
		week, err := h.svc.ReopenWeek(c.Context(), userID, weekID)
		if err != nil {
			week, err = h.svc.EnterReview(c.Context(), userID, weekID)
		}
		if err != nil {
			return handleWeeksError(c, err)
		}
		return c.JSON(fiber.Map{"data": week})
	default:
		return response.BadRequest(c, "status must be active or review")
	}
}

func (h *Handler) StartWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	week, err := h.svc.StartWeek(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": week})
}

func (h *Handler) EnterReview(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	week, err := h.svc.EnterReview(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": week})
}

func (h *Handler) ReopenWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	week, err := h.svc.ReopenWeek(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": week})
}

func (h *Handler) CloseWeek(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	closed, next, err := h.svc.CloseWeek(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"closed_week": closed, "next_week": next}})
}

func (h *Handler) ListPriorities(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	items, err := h.svc.ListPriorities(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h *Handler) AddPriority(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	weekID := c.Params("id")
	var req addPriorityRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	item, err := h.svc.AddPriority(c.Context(), userID, weekID, req.Text, req.OrderIndex)
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": item})
}

func (h *Handler) DeletePriority(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if err := h.svc.DeletePriority(c.Context(), userID, c.Params("id"), c.Params("priorityId")); err != nil {
		return handleWeeksError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListAllocations(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	items, err := h.svc.ListAllocations(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h *Handler) UpsertAllocation(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	weekID := c.Params("id")
	var req upsertAllocationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	slotMinute, err := parseSlotMinute(req)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	item, err := h.svc.UpsertAllocation(c.Context(), ports.UpsertAllocationParams{
		UserID:          userID,
		WeekID:          weekID,
		TaskID:          req.TaskID,
		DayOfWeek:       req.DayOfWeek,
		Lane:            domain.AllocationLane(req.Lane),
		SlotMinuteOfDay: slotMinute,
	})
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": item})
}

func (h *Handler) DeleteAllocation(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if err := h.svc.DeleteAllocation(c.Context(), userID, c.Params("id"), c.Params("allocationId")); err != nil {
		return handleWeeksError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ApplyReviewAction(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	weekID := c.Params("id")
	var req reviewActionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	err := h.svc.ApplyReviewAction(c.Context(), ports.ReviewActionParams{
		UserID:   userID,
		WeekID:   weekID,
		TaskIDs:  req.TaskIDs,
		Action:   domain.ReviewAction(req.Action),
		ToWeekID: req.ToWeekID,
	})
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) GetBalanceSnapshot(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	data, err := h.svc.GetBalanceSnapshot(c.Context(), userID, c.Params("id"))
	if err != nil {
		return handleWeeksError(c, err)
	}
	return c.JSON(fiber.Map{"data": data})
}
