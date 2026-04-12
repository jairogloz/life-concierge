package domain

import "fmt"

// RankedItem wraps a wishlist item with its heuristic ranking fields.
type RankedItem struct {
	Item        *WishlistItem `json:"item"`
	Rank        int           `json:"rank"`
	ItemROI     float64       `json:"item_roi"`
	ItemScore   float64       `json:"item_score"`
	Explanation string        `json:"explanation"`
}

// ComputeItemScore calculates ROI and score using normalized price and role/goal weights.
func ComputeItemScore(item *WishlistItem, roleWeight, goalWeight, usdToMXNRate float64) (roi, score float64, explanation string) {
	if roleWeight <= 0 {
		roleWeight = 1.0
	}
	if goalWeight <= 0 {
		goalWeight = 1.0
	}
	if usdToMXNRate <= 0 {
		usdToMXNRate = 17.5
	}

	normalizedPrice := item.Price
	if item.Currency == "USD" {
		normalizedPrice = item.Price * usdToMXNRate
	}
	if normalizedPrice <= 0 {
		normalizedPrice = 1.0
	}

	roi = float64(item.Impact) / normalizedPrice
	score = roi * goalWeight * roleWeight
	explanation = fmt.Sprintf("ROI %.4f = impact %d / %.2f MXN; score %.4f = ROI × goalW %.2f × roleW %.2f", roi, item.Impact, normalizedPrice, score, goalWeight, roleWeight)
	return roi, score, explanation
}
