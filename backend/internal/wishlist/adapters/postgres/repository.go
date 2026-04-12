package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
	"github.com/jairogloz/life-concierge/internal/wishlist/ports"
)

// WishlistRepository is a PostgreSQL-backed wishlist repository.
type WishlistRepository struct {
	db *pgxpool.Pool
}

// NewWishlistRepository creates a new PostgreSQL-backed WishlistRepository.
func NewWishlistRepository(db *pgxpool.Pool) *WishlistRepository {
	return &WishlistRepository{db: db}
}

const itemCols = `id, user_id, title, price, currency, role_id, goal_id, impact, roi_score, emotional_score, cooldown_days, verdict, verdict_reasoning, evaluated_at, bought_at, created_at, updated_at`

func scanItem(row interface{ Scan(...any) error }) (*domain.WishlistItem, error) {
	item := &domain.WishlistItem{}
	var verdictStr *string
	err := row.Scan(
		&item.ID, &item.UserID, &item.Title, &item.Price, &item.Currency,
		&item.RoleID, &item.GoalID, &item.Impact, &item.ROIScore, &item.EmotionalScore,
		&item.CooldownDays, &verdictStr, &item.VerdictReasoning, &item.EvaluatedAt, &item.BoughtAt,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if verdictStr != nil {
		v := domain.Verdict(*verdictStr)
		item.Verdict = &v
	}
	return item, nil
}

// CreateItem inserts a new wishlist item.
func (r *WishlistRepository) CreateItem(ctx context.Context, item *domain.WishlistItem) error {
	var verdictStr *string
	if item.Verdict != nil {
		s := string(*item.Verdict)
		verdictStr = &s
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO wishlist_items (`+itemCols+`) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
		item.ID, item.UserID, item.Title, item.Price, item.Currency,
		item.RoleID, item.GoalID, item.Impact, item.ROIScore, item.EmotionalScore,
		item.CooldownDays, verdictStr, item.VerdictReasoning, item.EvaluatedAt, item.BoughtAt,
		item.CreatedAt, item.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("wishlist.Create: %w", err)
	}
	return nil
}

// ListItems returns all wishlist items for the user, newest first.
func (r *WishlistRepository) ListItems(ctx context.Context, userID string, includeBought bool) ([]*domain.WishlistItem, error) {
	query := `SELECT ` + itemCols + ` FROM wishlist_items WHERE user_id=$1`
	args := []any{userID}
	if !includeBought {
		query += ` AND bought_at IS NULL`
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("wishlist.List: %w", err)
	}
	defer rows.Close()
	var items []*domain.WishlistItem
	for rows.Next() {
		item, err := scanItem(rows)
		if err != nil {
			return nil, fmt.Errorf("wishlist.List scan: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *WishlistRepository) MarkBought(ctx context.Context, userID, itemID string, boughtAt time.Time) error {
	_, err := r.db.Exec(ctx,
		`UPDATE wishlist_items SET bought_at=$1, updated_at=$2 WHERE id=$3 AND user_id=$4`,
		boughtAt, boughtAt, itemID, userID,
	)
	if err != nil {
		return fmt.Errorf("wishlist.MarkBought: %w", err)
	}
	return nil
}

// GetItem returns a single wishlist item by ID, scoped to the user.
func (r *WishlistRepository) GetItem(ctx context.Context, userID, itemID string) (*domain.WishlistItem, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+itemCols+` FROM wishlist_items WHERE id=$1 AND user_id=$2`,
		itemID, userID,
	)
	item, err := scanItem(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("wishlist item not found")
		}
		return nil, fmt.Errorf("wishlist.Get: %w", err)
	}
	return item, nil
}

// UpdateVerdict stores the AI verdict and scores on a wishlist item.
func (r *WishlistRepository) UpdateVerdict(ctx context.Context, item *domain.WishlistItem) error {
	var verdictStr *string
	if item.Verdict != nil {
		s := string(*item.Verdict)
		verdictStr = &s
	}
	_, err := r.db.Exec(ctx,
		`UPDATE wishlist_items SET verdict=$1, verdict_reasoning=$2, evaluated_at=$3, roi_score=$4, emotional_score=$5, updated_at=$6 WHERE id=$7 AND user_id=$8`,
		verdictStr, item.VerdictReasoning, item.EvaluatedAt,
		item.ROIScore, item.EmotionalScore, item.UpdatedAt,
		item.ID, item.UserID,
	)
	if err != nil {
		return fmt.Errorf("wishlist.UpdateVerdict: %w", err)
	}
	return nil
}

// Compile-time interface check.
var _ ports.WishlistRepository = (*WishlistRepository)(nil)
