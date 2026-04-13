package ports

import (
	"context"

	"github.com/jairogloz/life-concierge/internal/gamification/domain"
)

// GamificationService defines the input port for gamification.
type GamificationService interface {
	AwardTaskCompleted(ctx context.Context, userID string, roleID *string, taskTitle string) error
	AwardExpenseLogged(ctx context.Context, userID string, category string, amount float64) error
	AwardWishlistEvaluated(ctx context.Context, userID string, itemTitle string) error
	GetProfile(ctx context.Context, userID string) (*domain.GamificationProfile, error)
}
