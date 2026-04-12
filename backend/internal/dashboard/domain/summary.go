package domain

import (
	balancedomain "github.com/jairogloz/life-concierge/internal/balance/domain"
	rankingdomain "github.com/jairogloz/life-concierge/internal/ranking/domain"
)

// TodaySummary is the combined dashboard response for the Today view.
type TodaySummary struct {
	RoleBalanceSummary []balancedomain.RoleBalanceScore `json:"role_balance_summary"`
	RecommendedTasks   []*rankingdomain.ScoredTask      `json:"recommended_tasks"`
}
