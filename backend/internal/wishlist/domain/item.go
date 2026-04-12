package domain

import (
	"fmt"
	"time"
)

// Verdict represents the AI purchase decision for a wishlist item.
type Verdict string

const (
	VerdictBuyNow  Verdict = "buy_now"
	VerdictWait    Verdict = "wait"
	VerdictReject  Verdict = "reject"
	VerdictReplace Verdict = "replace"
)

// WishlistItem represents a potential purchase awaiting AI evaluation.
type WishlistItem struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	Title            string     `json:"title"`
	Price            float64    `json:"price"`
	Currency         string     `json:"currency"`
	RoleID           *string    `json:"role_id,omitempty"`
	GoalID           *string    `json:"goal_id,omitempty"`
	Impact           int        `json:"impact"`
	ROIScore         *float64   `json:"roi_score,omitempty"`
	EmotionalScore   *float64   `json:"emotional_score,omitempty"`
	CooldownDays     int        `json:"cooldown_days"`
	Verdict          *Verdict   `json:"verdict,omitempty"`
	VerdictReasoning *string    `json:"verdict_reasoning,omitempty"`
	EvaluatedAt      *time.Time `json:"evaluated_at,omitempty"`
	BoughtAt         *time.Time `json:"bought_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// Validate checks that the item has the required fields.
func (i *WishlistItem) Validate() error {
	if i.Title == "" {
		return fmt.Errorf("validation: title is required")
	}
	if i.UserID == "" {
		return fmt.Errorf("validation: user_id is required")
	}
	if i.Price < 0 {
		return fmt.Errorf("validation: price must be >= 0")
	}
	if i.Impact < 1 || i.Impact > 5 {
		return fmt.Errorf("validation: impact must be between 1 and 5")
	}
	return nil
}
