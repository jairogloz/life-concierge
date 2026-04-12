package application

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/google/uuid"
	timelinedomain "github.com/jairogloz/life-concierge/internal/timeline/domain"
	timelineports "github.com/jairogloz/life-concierge/internal/timeline/ports"
	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
	"github.com/jairogloz/life-concierge/internal/wishlist/ports"
)

// WishlistService implements ports.WishlistService.
type WishlistService struct {
	repo     ports.WishlistRepository
	agent    ports.WishlistAgent
	roles    ports.RoleReader
	goals    ports.GoalReader
	finance  ports.FinanceSummaryReader
	timeline timelineports.TimelineService
}

// SetTimeline wires the timeline service for event emission.
func (s *WishlistService) SetTimeline(tl timelineports.TimelineService) { s.timeline = tl }

// NewWishlistService creates a new WishlistService.
func NewWishlistService(
	repo ports.WishlistRepository,
	agent ports.WishlistAgent,
	roles ports.RoleReader,
	goals ports.GoalReader,
	finance ports.FinanceSummaryReader,
) *WishlistService {
	return &WishlistService{
		repo:    repo,
		agent:   agent,
		roles:   roles,
		goals:   goals,
		finance: finance,
	}
}

// CreateItem creates a new wishlist item for the user.
func (s *WishlistService) CreateItem(ctx context.Context, params ports.CreateItemParams) (*domain.WishlistItem, error) {
	now := time.Now().UTC()
	impact := params.Impact
	if impact == 0 {
		impact = 3
	}
	cooldown := params.CooldownDays
	if cooldown == 0 {
		cooldown = 30
	}
	currency := params.Currency
	if currency == "" {
		currency = "MXN"
	}
	item := &domain.WishlistItem{
		ID:           uuid.NewString(),
		UserID:       params.UserID,
		Title:        params.Title,
		Price:        params.Price,
		Currency:     currency,
		RoleID:       params.RoleID,
		GoalID:       params.GoalID,
		Impact:       impact,
		CooldownDays: cooldown,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := item.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.CreateItem(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

// ListItems returns all wishlist items for the user.
func (s *WishlistService) ListItems(ctx context.Context, userID string, includeBought bool) ([]*domain.WishlistItem, error) {
	return s.repo.ListItems(ctx, userID, includeBought)
}

func (s *WishlistService) MarkBought(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error) {
	item, err := s.repo.GetItem(ctx, userID, itemID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if err := s.repo.MarkBought(ctx, userID, itemID, now); err != nil {
		return nil, err
	}
	item.BoughtAt = &now
	item.UpdatedAt = now
	return item, nil
}

func (s *WishlistService) RankItems(ctx context.Context, userID string) ([]*domain.RankedItem, error) {
	items, err := s.repo.ListItems(ctx, userID, false)
	if err != nil {
		return nil, err
	}
	rate := getUSDToMXNRate()

	ranked := make([]*domain.RankedItem, 0, len(items))
	for _, item := range items {
		roleWeight := 1.0
		goalWeight := 1.0

		if item.RoleID != nil {
			if _, rw, rerr := s.roles.GetRole(ctx, userID, *item.RoleID); rerr == nil && rw > 0 {
				roleWeight = rw
			}
		}
		if item.GoalID != nil {
			if gw, gerr := s.goals.GetGoalWeight(ctx, userID, *item.GoalID); gerr == nil && gw > 0 {
				goalWeight = gw
			}
		}

		roi, score, explanation := domain.ComputeItemScore(item, roleWeight, goalWeight, rate)
		ranked = append(ranked, &domain.RankedItem{
			Item:        item,
			ItemROI:     roi,
			ItemScore:   score,
			Explanation: explanation,
		})
	}

	sort.Slice(ranked, func(i, j int) bool { return ranked[i].ItemScore > ranked[j].ItemScore })
	for i := range ranked {
		ranked[i].Rank = i + 1
	}

	return ranked, nil
}

// EvaluateItem runs the AI agent on a wishlist item and stores the verdict.
func (s *WishlistService) EvaluateItem(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error) {
	item, err := s.repo.GetItem(ctx, userID, itemID)
	if err != nil {
		return nil, err
	}

	evalCtx := ports.EvalContext{Item: item}

	// Fetch total balance — best-effort, failures do not block evaluation.
	if balance, berr := s.finance.GetTotalBalance(ctx, userID); berr == nil {
		evalCtx.TotalBalance = balance
	}

	// Fetch role context if present.
	if item.RoleID != nil {
		if name, weight, rerr := s.roles.GetRole(ctx, userID, *item.RoleID); rerr == nil {
			evalCtx.RoleName = name
			evalCtx.RoleWeight = weight
		}
	}

	// Fetch goal context if present.
	if item.GoalID != nil {
		if title, progress, gerr := s.goals.GetGoal(ctx, userID, *item.GoalID); gerr == nil {
			evalCtx.GoalTitle = title
			evalCtx.GoalProgress = progress
		}
	}

	verdict, reasoning, roiScore, emotionalScore, err := s.agent.Evaluate(ctx, evalCtx)
	if err != nil {
		return nil, fmt.Errorf("wishlist agent: %w", err)
	}

	now := time.Now().UTC()
	item.Verdict = &verdict
	item.VerdictReasoning = &reasoning
	item.ROIScore = &roiScore
	item.EmotionalScore = &emotionalScore
	item.EvaluatedAt = &now
	item.UpdatedAt = now

	if err := s.repo.UpdateVerdict(ctx, item); err != nil {
		return nil, err
	}
	if s.timeline != nil {
		go func() {
			_, _ = s.timeline.RecordEvent(context.Background(), timelineports.RecordEventParams{
				UserID:    userID,
				EventType: timelinedomain.EventWishlistEval,
				Domain:    "wishlist",
				EntityID:  &item.ID,
				Payload:   map[string]any{"title": item.Title, "verdict": verdict, "price": item.Price},
			})
		}()
	}
	return item, nil
}

// Compile-time interface check.
var _ ports.WishlistService = (*WishlistService)(nil)

func getUSDToMXNRate() float64 {
	v := os.Getenv("USD_TO_MXN_RATE")
	if v == "" {
		return 17.5
	}
	rate, err := strconv.ParseFloat(v, 64)
	if err != nil || rate <= 0 {
		return 17.5
	}
	return rate
}
