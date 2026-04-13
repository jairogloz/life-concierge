package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jairogloz/life-concierge/internal/gamification/domain"
	"github.com/jairogloz/life-concierge/internal/gamification/ports"
)

type Service struct {
	repo ports.GamificationRepository
}

func NewGamificationService(repo ports.GamificationRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) AwardTaskCompleted(ctx context.Context, userID string, roleID *string, taskTitle string) error {
	return s.award(ctx, ports.XPLogEntry{
		UserID:   userID,
		Source:   domain.SourceTaskCompleted,
		XPAmount: 15,
		Metadata: map[string]any{"task_title": taskTitle},
	}, roleID)
}

func (s *Service) AwardExpenseLogged(ctx context.Context, userID string, category string, amount float64) error {
	entry := ports.XPLogEntry{
		UserID:   userID,
		Source:   domain.SourceExpenseLogged,
		XPAmount: 8,
		Metadata: map[string]any{"category": category, "amount": amount},
	}
	if err := s.award(ctx, entry, nil); err != nil {
		return err
	}

	if strings.Contains(strings.ToLower(category), "invest") {
		_, err := s.repo.InsertAchievementIfMissing(ctx, ports.AchievementRecord{
			UserID:      userID,
			Code:        domain.AchievementFirstInvestmentLog,
			Title:       "First investment logged",
			Description: "Logged your first investment-related expense.",
			UnlockedAt:  time.Now().UTC(),
		})
		if err != nil {
			return fmt.Errorf("award investment achievement: %w", err)
		}
	}

	return nil
}

func (s *Service) AwardWishlistEvaluated(ctx context.Context, userID string, itemTitle string) error {
	entry := ports.XPLogEntry{
		UserID:   userID,
		Source:   domain.SourceWishlistEvaluated,
		XPAmount: 10,
		Metadata: map[string]any{"item_title": itemTitle},
	}
	if err := s.award(ctx, entry, nil); err != nil {
		return err
	}

	_, err := s.repo.InsertAchievementIfMissing(ctx, ports.AchievementRecord{
		UserID:      userID,
		Code:        domain.AchievementFirstWishlistEval,
		Title:       "First wishlist evaluation",
		Description: "Asked AI to evaluate your first wishlist item.",
		UnlockedAt:  time.Now().UTC(),
	})
	if err != nil {
		return fmt.Errorf("award wishlist achievement: %w", err)
	}
	return nil
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*domain.GamificationProfile, error) {
	totalXP, err := s.repo.GetTotalXP(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification profile: total xp: %w", err)
	}

	global, err := s.repo.GetGlobalStreak(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification profile: global streak: %w", err)
	}
	roleStreaks, err := s.repo.ListRoleStreaks(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification profile: role streaks: %w", err)
	}
	achievements, err := s.repo.ListRecentAchievements(ctx, userID, 5)
	if err != nil {
		return nil, fmt.Errorf("gamification profile: achievements: %w", err)
	}

	profile := &domain.GamificationProfile{
		TotalXP:             totalXP,
		GlobalCurrentStreak: 0,
		GlobalLongestStreak: 0,
		RoleStreaks:         roleStreaks,
		RecentAchievements:  achievements,
	}
	if global != nil {
		profile.GlobalCurrentStreak = global.CurrentStreak
		profile.GlobalLongestStreak = global.LongestStreak
	}
	if profile.RoleStreaks == nil {
		profile.RoleStreaks = []*domain.Streak{}
	}
	if profile.RecentAchievements == nil {
		profile.RecentAchievements = []*domain.Achievement{}
	}
	return profile, nil
}

func (s *Service) award(ctx context.Context, entry ports.XPLogEntry, roleID *string) error {
	now := time.Now().UTC()
	entry.CreatedAt = now
	if entry.Metadata == nil {
		entry.Metadata = map[string]any{}
	}

	if err := s.repo.InsertXPLog(ctx, entry); err != nil {
		return fmt.Errorf("insert xp log: %w", err)
	}

	global, err := s.repo.BumpStreak(ctx, entry.UserID, domain.ScopeGlobal, nil, now)
	if err != nil {
		return fmt.Errorf("bump global streak: %w", err)
	}
	if roleID != nil && *roleID != "" {
		if _, err := s.repo.BumpStreak(ctx, entry.UserID, domain.ScopeRole, roleID, now); err != nil {
			return fmt.Errorf("bump role streak: %w", err)
		}
	}

	_, err = s.repo.InsertAchievementIfMissing(ctx, ports.AchievementRecord{
		UserID:      entry.UserID,
		Code:        domain.AchievementFirstXP,
		Title:       "XP unlocked",
		Description: "Earned XP for the first time.",
		UnlockedAt:  now,
	})
	if err != nil {
		return fmt.Errorf("award first xp achievement: %w", err)
	}

	if global != nil && global.CurrentStreak >= 7 {
		_, err = s.repo.InsertAchievementIfMissing(ctx, ports.AchievementRecord{
			UserID:      entry.UserID,
			Code:        domain.AchievementStreak7Days,
			Title:       "7-day streak",
			Description: "Stayed active for 7 days in a row.",
			UnlockedAt:  now,
		})
		if err != nil {
			return fmt.Errorf("award streak achievement: %w", err)
		}
	}

	return nil
}

var _ ports.GamificationService = (*Service)(nil)
