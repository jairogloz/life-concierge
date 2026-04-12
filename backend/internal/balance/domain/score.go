package domain

// RoleBalanceScore holds the computed balance result for a single role.
type RoleBalanceScore struct {
	RoleID    string `json:"role_id"`
	RoleName  string `json:"role_name"`
	RoleColor string `json:"role_color"`
	// Actual is the summed task contribution value in the rolling window.
	Actual float64 `json:"actual"`
	// Expected is the proportional share of capacity for this role.
	Expected float64 `json:"expected"`
	// BalanceScore is Actual/Expected capped at 1.0.
	BalanceScore float64 `json:"balance_score"`
	// DisplayPct is BalanceScore * 100, formatted for UI (0-100).
	DisplayPct float64 `json:"display_pct"`
}

// TaskContribution is a single completed task's contribution data.
type TaskContribution struct {
	RoleID     string
	RoleWeight float64
	GoalWeight float64
	Impact     int
	TaskType   string // "one_time" or "daily"
}

// RoleWeight is the lightweight role record used for balance calculations.
type RoleWeight struct {
	ID     string
	Name   string
	Weight float64
	Color  string
}
