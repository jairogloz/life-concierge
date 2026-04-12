package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
)

// CreateItemParams holds parameters for creating a new wishlist item.
type CreateItemParams struct {
	UserID       string
	Title        string
	Price        float64
	Currency     string
	RoleID       *string
	GoalID       *string
	Impact       int
	CooldownDays int
}

// WishlistService defines the input port for the wishlist domain.
type WishlistService interface {
	CreateItem(ctx context.Context, params CreateItemParams) (*domain.WishlistItem, error)
	ListItems(ctx context.Context, userID string, includeBought bool) ([]*domain.WishlistItem, error)
	MarkBought(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error)
	RankItems(ctx context.Context, userID string) ([]*domain.RankedItem, error)
	EvaluateItem(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error)
}
