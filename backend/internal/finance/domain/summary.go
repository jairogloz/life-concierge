package domain

// FinanceSummary aggregates key financial metrics for a user.
type FinanceSummary struct {
	TotalBalance  float64            `json:"total_balance"`
	MonthIncome   float64            `json:"month_income"`
	MonthExpenses float64            `json:"month_expenses"`
	ByCategory    map[string]float64 `json:"by_category"`
	Currency      string             `json:"currency"`
}
