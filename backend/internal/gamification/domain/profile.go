package domain

import "time"

const (
	SourceTaskCompleted     = "task_completed"
	SourceExpenseLogged     = "expense_logged"
	SourceWishlistEvaluated = "wishlist_evaluated"
)

const (
	AchievementFirstXP            = "first_xp"
	AchievementStreak7Days        = "streak_7_days"
	AchievementFirstInvestmentLog = "first_investment_logged"
	AchievementFirstWishlistEval  = "first_wishlist_eval"
)

const (
	ScopeGlobal = "global"
	ScopeRole   = "role"
)

type Streak struct {
	ScopeType        string     `json:"scope_type"`
	RoleID           *string    `json:"role_id,omitempty"`
	RoleName         *string    `json:"role_name,omitempty"`
	CurrentStreak    int        `json:"current_streak"`
	LongestStreak    int        `json:"longest_streak"`
	LastActivityDate *time.Time `json:"last_activity_date,omitempty"`
}

type Achievement struct {
	Code        string    `json:"code"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	UnlockedAt  time.Time `json:"unlocked_at"`
}

type GamificationProfile struct {
	TotalXP             int            `json:"total_xp"`
	GlobalCurrentStreak int            `json:"global_current_streak"`
	GlobalLongestStreak int            `json:"global_longest_streak"`
	RoleStreaks         []*Streak      `json:"role_streaks"`
	RecentAchievements  []*Achievement `json:"recent_achievements"`
}
