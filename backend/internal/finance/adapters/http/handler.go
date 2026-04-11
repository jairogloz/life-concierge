package financehttp

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/jairogloz/life-concierge/internal/finance/domain"
	"github.com/jairogloz/life-concierge/internal/finance/ports"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
	"github.com/jairogloz/life-concierge/internal/shared/response"
)

// Handler holds the HTTP handlers for the finance domain.
type Handler struct {
	svc ports.FinanceService
}

// NewHandler creates a new finance HTTP handler.
func NewHandler(svc ports.FinanceService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes attaches all finance routes to the provided Fiber router.
func RegisterRoutes(router fiber.Router, svc ports.FinanceService) {
	h := NewHandler(svc)
	router.Post("/accounts", h.CreateAccount)
	router.Get("/accounts", h.ListAccounts)
	router.Post("/transactions", h.CreateTransaction)
	router.Get("/transactions", h.ListTransactions)
	router.Post("/transfers", h.CreateTransfer)
	router.Get("/finance/summary", h.GetSummary)
}

// ── Request types ─────────────────────────────────────────────────────────────

type createAccountRequest struct {
	Name     string             `json:"name"`
	Type     domain.AccountType `json:"type"`
	Currency string             `json:"currency"`
	Balance  float64            `json:"balance"`
}

type splitInput struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

type createTransactionRequest struct {
	AccountID   string                 `json:"account_id"`
	Type        domain.TransactionType `json:"type"`
	Amount      float64                `json:"amount"`
	Currency    string                 `json:"currency"`
	Category    string                 `json:"category"`
	RoleID      *string                `json:"role_id"`
	Description string                 `json:"description"`
	Date        *string                `json:"date"`
	Splits      []splitInput           `json:"splits"`
}

type createTransferRequest struct {
	FromAccountID string  `json:"from_account_id"`
	ToAccountID   string  `json:"to_account_id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Description   string  `json:"description"`
	Date          *string `json:"date"`
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (h *Handler) CreateAccount(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createAccountRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}
	acc, err := h.svc.CreateAccount(c.Context(), ports.CreateAccountParams{
		UserID:   userID,
		Name:     req.Name,
		Type:     req.Type,
		Currency: req.Currency,
		Balance:  req.Balance,
	})
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(acc)
}

func (h *Handler) ListAccounts(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	accounts, err := h.svc.ListAccounts(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	if accounts == nil {
		accounts = []*domain.Account{}
	}
	return c.JSON(fiber.Map{"data": accounts})
}

func (h *Handler) CreateTransaction(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createTransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	var splits []ports.SplitInput
	for _, s := range req.Splits {
		splits = append(splits, ports.SplitInput{
			Category:   s.Category,
			Amount:     s.Amount,
			Percentage: s.Percentage,
		})
	}

	params := ports.CreateTransactionParams{
		AccountID:   req.AccountID,
		UserID:      userID,
		Type:        req.Type,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Category:    req.Category,
		RoleID:      req.RoleID,
		Description: req.Description,
		Splits:      splits,
	}
	if req.Date != nil {
		t, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			return response.BadRequest(c, "invalid date format, use YYYY-MM-DD")
		}
		params.Date = &t
	}

	tx, err := h.svc.CreateTransaction(c.Context(), params)
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(tx)
}

func (h *Handler) ListTransactions(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	accountID := c.Query("account_id")
	txns, err := h.svc.ListTransactions(c.Context(), userID, accountID)
	if err != nil {
		return response.InternalError(c)
	}
	if txns == nil {
		txns = []*domain.Transaction{}
	}
	return c.JSON(fiber.Map{"data": txns})
}

func (h *Handler) CreateTransfer(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req createTransferRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	params := ports.CreateTransferParams{
		UserID:        userID,
		FromAccountID: req.FromAccountID,
		ToAccountID:   req.ToAccountID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Description:   req.Description,
	}
	if req.Date != nil {
		t, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			return response.BadRequest(c, "invalid date format, use YYYY-MM-DD")
		}
		params.Date = &t
	}

	tr, err := h.svc.CreateTransfer(c.Context(), params)
	if err != nil {
		if isValidationError(err) {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c)
	}
	return c.Status(fiber.StatusCreated).JSON(tr)
}

func (h *Handler) GetSummary(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	summary, err := h.svc.GetSummary(c.Context(), userID)
	if err != nil {
		return response.InternalError(c)
	}
	return c.JSON(summary)
}

// isValidationError returns true when the error originates from domain validation.
func isValidationError(err error) bool {
	return strings.HasPrefix(err.Error(), "validation:")
}
