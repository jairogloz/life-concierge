package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jairogloz/life-concierge/internal/gamification/domain"
	"github.com/jairogloz/life-concierge/internal/gamification/ports"
)

// Repository is a PostgreSQL-backed gamification repository.
type Repository struct {
	db *pgxpool.Pool
}

// NewGamificationRepository creates a new gamification repository.
func NewGamificationRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) InsertXPLog(ctx context.Context, entry ports.XPLogEntry) error {
	metadataBytes, err := json.Marshal(entry.Metadata)
	if err != nil {
		return fmt.Errorf("gamification.InsertXPLog marshal metadata: %w", err)
	}
	_, err = r.db.Exec(ctx,
		`INSERT INTO xp_log (user_id, source, xp_amount, metadata, created_at) VALUES ($1,$2,$3,$4,$5)`,
		entry.UserID, entry.Source, entry.XPAmount, metadataBytes, entry.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("gamification.InsertXPLog: %w", err)
	}
	return nil
}

func scopeKey(scopeType string, roleID *string) string {
	if scopeType == domain.ScopeRole && roleID != nil {
		return "role:" + *roleID
	}
	return domain.ScopeGlobal
}

func (r *Repository) BumpStreak(ctx context.Context, userID, scopeType string, roleID *string, activityDate time.Time) (*domain.Streak, error) {
	key := scopeKey(scopeType, roleID)
	date := activityDate.UTC()

	row := r.db.QueryRow(ctx, `
		INSERT INTO user_streaks (user_id, scope_type, role_id, scope_key, current_streak, longest_streak, last_activity_date, created_at, updated_at)
		VALUES ($1,$2,$3,$4,1,1,$5::date,NOW(),NOW())
		ON CONFLICT (user_id, scope_key)
		DO UPDATE SET
			current_streak = CASE
				WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date THEN user_streaks.current_streak
				WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date - INTERVAL '1 day' THEN user_streaks.current_streak + 1
				ELSE 1
			END,
			longest_streak = GREATEST(
				user_streaks.longest_streak,
				CASE
					WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date THEN user_streaks.current_streak
					WHEN user_streaks.last_activity_date = EXCLUDED.last_activity_date - INTERVAL '1 day' THEN user_streaks.current_streak + 1
					ELSE 1
				END
			),
			last_activity_date = EXCLUDED.last_activity_date,
			updated_at = NOW()
		RETURNING scope_type, role_id::text, current_streak, longest_streak, last_activity_date::timestamptz
	`, userID, scopeType, roleID, key, date)

	var result domain.Streak
	var roleIDText *string
	if err := row.Scan(&result.ScopeType, &roleIDText, &result.CurrentStreak, &result.LongestStreak, &result.LastActivityDate); err != nil {
		return nil, fmt.Errorf("gamification.BumpStreak: %w", err)
	}
	result.RoleID = roleIDText
	return &result, nil
}

func (r *Repository) GetGlobalStreak(ctx context.Context, userID string) (*domain.Streak, error) {
	row := r.db.QueryRow(ctx, `
		SELECT scope_type, role_id::text, current_streak, longest_streak, last_activity_date::timestamptz
		FROM user_streaks
		WHERE user_id = $1 AND scope_type = 'global'
	`, userID)

	var s domain.Streak
	var roleID *string
	if err := row.Scan(&s.ScopeType, &roleID, &s.CurrentStreak, &s.LongestStreak, &s.LastActivityDate); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("gamification.GetGlobalStreak: %w", err)
	}
	s.RoleID = roleID
	return &s, nil
}

func (r *Repository) ListRoleStreaks(ctx context.Context, userID string) ([]*domain.Streak, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.scope_type, s.role_id::text, r.name, s.current_streak, s.longest_streak, s.last_activity_date::timestamptz
		FROM user_streaks s
		JOIN roles r ON r.id = s.role_id
		WHERE s.user_id = $1 AND s.scope_type = 'role'
		ORDER BY s.current_streak DESC, s.longest_streak DESC, r.name ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("gamification.ListRoleStreaks: %w", err)
	}
	defer rows.Close()

	var out []*domain.Streak
	for rows.Next() {
		var s domain.Streak
		var roleID string
		var roleName string
		if err := rows.Scan(&s.ScopeType, &roleID, &roleName, &s.CurrentStreak, &s.LongestStreak, &s.LastActivityDate); err != nil {
			return nil, fmt.Errorf("gamification.ListRoleStreaks scan: %w", err)
		}
		s.RoleID = &roleID
		s.RoleName = &roleName
		out = append(out, &s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) GetTotalXP(ctx context.Context, userID string) (int, error) {
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COALESCE(SUM(xp_amount), 0) FROM xp_log WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return 0, fmt.Errorf("gamification.GetTotalXP: %w", err)
	}
	return total, nil
}

func (r *Repository) InsertAchievementIfMissing(ctx context.Context, a ports.AchievementRecord) (bool, error) {
	cmd, err := r.db.Exec(ctx, `
		INSERT INTO achievements (user_id, code, title, description, unlocked_at, created_at)
		VALUES ($1,$2,$3,$4,$5,NOW())
		ON CONFLICT (user_id, code) DO NOTHING
	`, a.UserID, a.Code, a.Title, a.Description, a.UnlockedAt)
	if err != nil {
		return false, fmt.Errorf("gamification.InsertAchievementIfMissing: %w", err)
	}
	return cmd.RowsAffected() > 0, nil
}

func (r *Repository) ListRecentAchievements(ctx context.Context, userID string, limit int) ([]*domain.Achievement, error) {
	if limit <= 0 {
		limit = 5
	}
	rows, err := r.db.Query(ctx, `
		SELECT code, title, description, unlocked_at
		FROM achievements
		WHERE user_id = $1
		ORDER BY unlocked_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("gamification.ListRecentAchievements: %w", err)
	}
	defer rows.Close()

	out := []*domain.Achievement{}
	for rows.Next() {
		var a domain.Achievement
		if err := rows.Scan(&a.Code, &a.Title, &a.Description, &a.UnlockedAt); err != nil {
			return nil, fmt.Errorf("gamification.ListRecentAchievements scan: %w", err)
		}
		out = append(out, &a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

var _ ports.GamificationRepository = (*Repository)(nil)
