package domain

import "time"

// Action is a recommended action for the user today.
type Action struct {
	Priority    int    `json:"priority"`
	Description string `json:"description"`
	Domain      string `json:"domain"`
}

// DailyBrief is the output of the daily strategy agent.
type DailyBrief struct {
	TopActions  []Action  `json:"top_actions"`
	FinanceAlert string   `json:"finance_alert"`
	HealthNudge  string   `json:"health_nudge"`
	GeneratedAt  time.Time `json:"generated_at"`
}
