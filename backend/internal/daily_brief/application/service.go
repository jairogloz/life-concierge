package application

import (
	"context"
	"fmt"
	"time"

	"github.com/jairogloz/life-concierge/internal/daily_brief/domain"
	"github.com/jairogloz/life-concierge/internal/daily_brief/ports"
)

// DailyBriefService implements ports.DailyBriefService.
type DailyBriefService struct {
	timeline ports.TimelineReader
	goals    ports.GoalsReader
	roles    ports.RolesReader
	finance  ports.FinanceReader
	agent    ports.StrategyAgent
}

// NewDailyBriefService creates a new DailyBriefService.
func NewDailyBriefService(
	timeline ports.TimelineReader,
	goals ports.GoalsReader,
	roles ports.RolesReader,
	finance ports.FinanceReader,
	agent ports.StrategyAgent,
) *DailyBriefService {
	return &DailyBriefService{
		timeline: timeline,
		goals:    goals,
		roles:    roles,
		finance:  finance,
		agent:    agent,
	}
}

// GetDailyBrief assembles context and asks the agent to generate a brief.
func (s *DailyBriefService) GetDailyBrief(ctx context.Context, userID string) (*domain.DailyBrief, error) {
	since := time.Now().UTC().AddDate(0, 0, -30)

	// Gather data best-effort — partial context still yields a useful brief.
	events, _ := s.timeline.ListRecentEvents(ctx, userID, since)
	goals, _ := s.goals.ListGoals(ctx, userID)
	roles, _ := s.roles.ListRoles(ctx, userID)
	balance, _ := s.finance.GetTotalBalance(ctx, userID)

	brief, err := s.agent.GenerateBrief(ctx, ports.BriefInput{
		Events:  events,
		Goals:   goals,
		Roles:   roles,
		Balance: balance,
	})
	if err != nil {
		return nil, fmt.Errorf("daily_brief: agent failed: %w", err)
	}
	brief.GeneratedAt = time.Now().UTC()
	return brief, nil
}

var _ ports.DailyBriefService = (*DailyBriefService)(nil)
