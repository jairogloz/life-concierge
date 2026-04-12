package application

import (
	"context"
	"testing"
	"time"

	"github.com/jairogloz/life-concierge/internal/balance/domain"
)

// ── Mock repository ───────────────────────────────────────────────────────────

type mockRepo struct {
	roles         []domain.RoleWeight
	contributions []domain.TaskContribution
}

func (m *mockRepo) FetchRoles(_ context.Context, _ string) ([]domain.RoleWeight, error) {
	return m.roles, nil
}

func (m *mockRepo) FetchCompletedContributions(_ context.Context, _ string, _ time.Time) ([]domain.TaskContribution, error) {
	return m.contributions, nil
}

// ── Test cases ────────────────────────────────────────────────────────────────

// Case 1: no roles -> empty result
func TestGetRoleBalanceSummary_NoRoles(t *testing.T) {
	svc := NewBalanceService(&mockRepo{})
	result, err := svc.GetRoleBalanceSummary(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 results, got %d", len(result))
	}
}

// Case 2: 1 role, 1 completed one_time task -> correct score
func TestGetRoleBalanceSummary_OneTaskOneRole(t *testing.T) {
	svc := NewBalanceService(&mockRepo{
		roles: []domain.RoleWeight{
			{ID: "r1", Name: "Engineering", Weight: 5.0, Color: "#00f"},
		},
		contributions: []domain.TaskContribution{
			{RoleID: "r1", RoleWeight: 5.0, GoalWeight: 1.0, Impact: 3, TaskType: "one_time"},
		},
	})
	result, err := svc.GetRoleBalanceSummary(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 result, got %d", len(result))
	}
	// actual   = 5.0 * 1.0 * 3 * 1.25 = 18.75
	// expected = (5/5) * 50 = 50
	// balance  = 18.75 / 50 = 0.375
	want := 0.375
	if diff := result[0].BalanceScore - want; diff < -0.01 || diff > 0.01 {
		t.Errorf("balance score = %.4f, want %.4f", result[0].BalanceScore, want)
	}
}

// Case 3: 2 roles, tasks only in one -> other role score = 0
func TestGetRoleBalanceSummary_TwoRolesOnlyOneHasTasks(t *testing.T) {
	svc := NewBalanceService(&mockRepo{
		roles: []domain.RoleWeight{
			{ID: "r1", Name: "Engineering", Weight: 5.0, Color: "#00f"},
			{ID: "r2", Name: "Health", Weight: 5.0, Color: "#0f0"},
		},
		contributions: []domain.TaskContribution{
			{RoleID: "r1", RoleWeight: 5.0, GoalWeight: 1.0, Impact: 5, TaskType: "one_time"},
		},
	})
	result, err := svc.GetRoleBalanceSummary(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Health has 0 actual -> balance score 0 -> appears first (sorted ascending)
	if result[0].RoleID != "r2" {
		t.Errorf("expected most-neglected role to be r2 (Health), got %s", result[0].RoleID)
	}
	if result[0].BalanceScore != 0.0 {
		t.Errorf("expected balance score 0 for neglected role, got %v", result[0].BalanceScore)
	}
}

// Case 4: score capped at 1.0 when actual > expected
func TestGetRoleBalanceSummary_ScoreCappedAt1(t *testing.T) {
	var cs []domain.TaskContribution
	for i := 0; i < 50; i++ {
		cs = append(cs, domain.TaskContribution{
			RoleID:     "r1",
			RoleWeight: 5.0,
			GoalWeight: 1.0,
			Impact:     5,
			TaskType:   "one_time",
		})
	}
	svc := NewBalanceService(&mockRepo{
		roles:         []domain.RoleWeight{{ID: "r1", Name: "Engineering", Weight: 5.0, Color: "#00f"}},
		contributions: cs,
	})
	result, err := svc.GetRoleBalanceSummary(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result[0].BalanceScore != 1.0 {
		t.Errorf("fully-served role should score exactly 1.0, got %v", result[0].BalanceScore)
	}
}

// Case 5: daily task contribution uses 0.9 multiplier
func TestGetRoleBalanceSummary_DailyTaskContribution(t *testing.T) {
	svc := NewBalanceService(&mockRepo{
		roles: []domain.RoleWeight{
			{ID: "r1", Name: "Health", Weight: 5.0, Color: "#0f0"},
		},
		contributions: []domain.TaskContribution{
			{RoleID: "r1", RoleWeight: 5.0, GoalWeight: 1.0, Impact: 4, TaskType: "daily"},
		},
	})
	result, err := svc.GetRoleBalanceSummary(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// actual   = 5.0 * 1.0 * 4 * 0.9 = 18.0
	// expected = (5/5) * 50 = 50
	// balance  = 18.0 / 50 = 0.36
	want := 0.36
	if diff := result[0].BalanceScore - want; diff < -0.01 || diff > 0.01 {
		t.Errorf("balance score = %.4f, want %.4f (daily mult 0.9)", result[0].BalanceScore, want)
	}
}

// Case 6: GetRoleBalanceScores returns correct map keyed by role ID
func TestGetRoleBalanceScores_ReturnsMap(t *testing.T) {
	svc := NewBalanceService(&mockRepo{
		roles: []domain.RoleWeight{
			{ID: "r1", Name: "Engineering", Weight: 5.0, Color: "#00f"},
			{ID: "r2", Name: "Health", Weight: 5.0, Color: "#0f0"},
		},
		contributions: []domain.TaskContribution{
			{RoleID: "r1", RoleWeight: 5.0, GoalWeight: 1.0, Impact: 5, TaskType: "one_time"},
		},
	})
	scores, err := svc.GetRoleBalanceScores(context.Background(), "user1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(scores) != 2 {
		t.Fatalf("expected 2 scores, got %d", len(scores))
	}
	if scores["r2"] != 0.0 {
		t.Errorf("neglected role r2 should have score 0, got %v", scores["r2"])
	}
	if scores["r1"] <= 0 {
		t.Errorf("active role r1 should have positive score, got %v", scores["r1"])
	}
}
