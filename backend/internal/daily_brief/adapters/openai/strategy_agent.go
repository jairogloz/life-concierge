package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	openaiSDK "github.com/sashabaranov/go-openai"

	"github.com/jairogloz/life-concierge/internal/daily_brief/domain"
	"github.com/jairogloz/life-concierge/internal/daily_brief/ports"
)

// StrategyAgent uses OpenAI to generate a daily brief.
type StrategyAgent struct {
	client *openaiSDK.Client
	model  string
}

// NewStrategyAgent creates a new OpenAI-backed StrategyAgent.
func NewStrategyAgent(client *openaiSDK.Client, model string) *StrategyAgent {
	return &StrategyAgent{client: client, model: model}
}

const systemPrompt = `You are a life strategy advisor helping users prioritize and plan their day.
Given a summary of the user's recent activity, life goals, roles, and financial balance, produce a concise daily brief.

Return ONLY a valid JSON object with this exact shape:
{
  "top_actions": [
    {"priority": 1, "description": "...", "domain": "goals|tasks|finance|wellbeing"},
    {"priority": 2, "description": "...", "domain": "..."},
    {"priority": 3, "description": "...", "domain": "..."}
  ],
  "finance_alert": "one sentence alert, or empty string if finances look healthy",
  "health_nudge": "one sentence wellbeing or habit nudge"
}

Rules:
- top_actions should be actionable, specific, and achievable today
- reference goal names and role names when relevant
- finance_alert should only call out genuine concerns (low balance, no recent logging)
- health_nudge should be encouraging, not preachy`

type agentResponse struct {
	TopActions   []domain.Action `json:"top_actions"`
	FinanceAlert string          `json:"finance_alert"`
	HealthNudge  string          `json:"health_nudge"`
}

// GenerateBrief produces a DailyBrief from the given input context.
func (a *StrategyAgent) GenerateBrief(ctx context.Context, input ports.BriefInput) (*domain.DailyBrief, error) {
	prompt := buildPrompt(input)

	resp, err := a.client.CreateChatCompletion(ctx, openaiSDK.ChatCompletionRequest{
		Model: a.model,
		Messages: []openaiSDK.ChatCompletionMessage{
			{Role: openaiSDK.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openaiSDK.ChatMessageRoleUser, Content: prompt},
		},
		ResponseFormat: &openaiSDK.ChatCompletionResponseFormat{
			Type: openaiSDK.ChatCompletionResponseFormatTypeJSONObject,
		},
		MaxTokens: 600,
	})
	if err != nil {
		return nil, fmt.Errorf("strategy_agent: openai: %w", err)
	}

	raw := strings.TrimSpace(resp.Choices[0].Message.Content)
	var res agentResponse
	if err := json.Unmarshal([]byte(raw), &res); err != nil {
		return nil, fmt.Errorf("strategy_agent: parse response: %w", err)
	}

	return &domain.DailyBrief{
		TopActions:   res.TopActions,
		FinanceAlert: res.FinanceAlert,
		HealthNudge:  res.HealthNudge,
	}, nil
}

func buildPrompt(input ports.BriefInput) string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "## Financial Context\n")
	fmt.Fprintf(&sb, "Total account balance: $%.2f\n\n", input.Balance)

	fmt.Fprintf(&sb, "## Life Roles\n")
	if len(input.Roles) == 0 {
		fmt.Fprintf(&sb, "No roles defined yet.\n")
	} else {
		for _, r := range input.Roles {
			fmt.Fprintf(&sb, "- %s (weight: %.1f)\n", r.Name, r.Weight)
		}
	}
	fmt.Fprintf(&sb, "\n")

	fmt.Fprintf(&sb, "## Active Goals\n")
	if len(input.Goals) == 0 {
		fmt.Fprintf(&sb, "No active goals.\n")
	} else {
		for _, g := range input.Goals {
			deadline := "no deadline"
			if g.Deadline != nil {
				deadline = g.Deadline.Format("2006-01-02")
			}
			fmt.Fprintf(&sb, "- [%s] %s (status: %s, deadline: %s)\n", g.RoleID, g.Title, g.Status, deadline)
		}
	}
	fmt.Fprintf(&sb, "\n")

	fmt.Fprintf(&sb, "## Recent Activity (last 30 days, %d events)\n", len(input.Events))
	eventCounts := map[string]int{}
	for _, e := range input.Events {
		eventCounts[string(e.EventType)]++
	}
	for evtType, count := range eventCounts {
		fmt.Fprintf(&sb, "- %s: %d times\n", evtType, count)
	}

	return sb.String()
}

var _ ports.StrategyAgent = (*StrategyAgent)(nil)
