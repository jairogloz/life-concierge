package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
)

// WishlistRepository defines the output port for wishlist persistence.
type WishlistRepository interface {
	CreateItem(ctx context.Context, item *domain.WishlistItem) error
	ListItems(ctx context.Context, userID string) ([]*domain.WishlistItem, error)
	GetItem(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error)
	UpdateVerdict(ctx context.Context, item *domain.WishlistItem) error
}

// EvalContext holds the context passed to the AI agent for evaluation.
type EvalContext struct {
	Item         *domain.WishlistItem
	TotalBalance float64
	RoleName     string
	RoleWeight   float64
	GoalTitle    string
	GoalProgress float64
}

// WishlistAgent defines the port for AI-based verdict generation.
type WishlistAgent interface {
	Evaluate(ctx context.Context, evalCtx EvalContext) (verdict domain.Verdict, reasoning string, roiScore float64, emotionalScore float64, err error)
}

// RoleReader reads role data for wishlist evaluation context.
type RoleReader interface {
	GetRole(ctx context.Context, userID, roleID string) (name string, weight float64, err error)
}

// GoalReader reads goal data for wishlist evaluation context.
type GoalReader interface {
	GetGoal(ctx context.Context, userID, goalID string) (title string, progress float64, err error)
}

// FinanceSummaryReader reads the user's total balance.
type FinanceSummaryReader interface {
	GetTotalBalance(ctx context.Context, userID string) (float64, error)
}
