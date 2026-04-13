package ports

import (
	"context"
	"time"

	"github.com/jairogloz/life-concierge/internal/gamification/domain"
)

// XPLogEntry is one XP award event.
type XPLogEntry struct {
	UserID    string
	Source    string
	XPAmount  int
	Metadata  map[string]any
	CreatedAt time.Time
}

// AchievementRecord is the payload to persist an unlocked achievement.
type AchievementRecord struct {
	UserID      string
	Code        string
	Title       string
	Description string
	UnlockedAt  time.Time
}

// GamificationRepository defines gamification persistence operations.
type GamificationRepository interface {
	InsertXPLog(ctx context.Context, entry XPLogEntry) error
	BumpStreak(ctx context.Context, userID, scopeType string, roleID *string, activityDate time.Time) (*domain.Streak, error)
	GetGlobalStreak(ctx context.Context, userID string) (*domain.Streak, error)
	ListRoleStreaks(ctx context.Context, userID string) ([]*domain.Streak, error)
	GetTotalXP(ctx context.Context, userID string) (int, error)
	InsertAchievementIfMissing(ctx context.Context, achievement AchievementRecord) (bool, error)
	ListRecentAchievements(ctx context.Context, userID string, limit int) ([]*domain.Achievement, error)
}
