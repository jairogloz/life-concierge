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
	Importance   int
	CooldownDays int
}

// WishlistService defines the input port for the wishlist domain.
type WishlistService interface {
	CreateItem(ctx context.Context, params CreateItemParams) (*domain.WishlistItem, error)
	ListItems(ctx context.Context, userID string) ([]*domain.WishlistItem, error)
	EvaluateItem(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error)
}
