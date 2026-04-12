package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	openaiSDK "github.com/sashabaranov/go-openai"

	"github.com/jairogloz/life-concierge/internal/wishlist/domain"
	"github.com/jairogloz/life-concierge/internal/wishlist/ports"
)

// WishlistAgent uses OpenAI to evaluate wishlist items and produce a purchase verdict.
type WishlistAgent struct {
	client *openaiSDK.Client
	model  string
}

// NewWishlistAgent creates a new OpenAI-backed wishlist agent.
func NewWishlistAgent(client *openaiSDK.Client, model string) *WishlistAgent {
	return &WishlistAgent{client: client, model: model}
}

type verdictResponse struct {
	Verdict        string  `json:"verdict"`
	Reasoning      string  `json:"reasoning"`
	ROIScore       float64 `json:"roi_score"`
	EmotionalScore float64 `json:"emotional_score"`
}

const agentSystemPrompt = `You are a personal finance and life-alignment advisor.
Given information about a potential purchase and the user's financial/life context, decide whether they should buy it.
Return ONLY a valid JSON object:
{"verdict":"buy_now|wait|reject|replace","reasoning":"2-3 sentence explanation","roi_score":0.0,"emotional_score":0.0}

Verdict meanings:
- buy_now:  financially sound, aligns with goals/roles, worth purchasing now
- wait:     good idea but timing or finances are not right yet
- reject:   poor alignment with life priorities, low ROI, or likely an impulse buy
- replace:  the need is valid but a better or cheaper alternative likely exists

roi_score:       0-10, estimated return on investment or life value
emotional_score: 0-10, emotional importance to the user's wellbeing`

// Evaluate returns a verdict and reasoning for the given wishlist item.
func (a *WishlistAgent) Evaluate(ctx context.Context, evalCtx ports.EvalContext) (domain.Verdict, string, float64, float64, error) {
	prompt := buildEvalPrompt(evalCtx)

	resp, err := a.client.CreateChatCompletion(ctx, openaiSDK.ChatCompletionRequest{
		Model: a.model,
		Messages: []openaiSDK.ChatCompletionMessage{
			{Role: openaiSDK.ChatMessageRoleSystem, Content: agentSystemPrompt},
			{Role: openaiSDK.ChatMessageRoleUser, Content: prompt},
		},
		ResponseFormat: &openaiSDK.ChatCompletionResponseFormat{
			Type: openaiSDK.ChatCompletionResponseFormatTypeJSONObject,
		},
		MaxTokens: 512,
	})
	if err != nil {
		return "", "", 0, 0, fmt.Errorf("openai: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", "", 0, 0, fmt.Errorf("openai: no choices in response")
	}

	var vr verdictResponse
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &vr); err != nil {
		return "", "", 0, 0, fmt.Errorf("openai: parse verdict: %w", err)
	}

	verdict := domain.Verdict(strings.ToLower(vr.Verdict))
	validVerdicts := map[domain.Verdict]bool{
		domain.VerdictBuyNow:  true,
		domain.VerdictWait:    true,
		domain.VerdictReject:  true,
		domain.VerdictReplace: true,
	}
	if !validVerdicts[verdict] {
		verdict = domain.VerdictWait
	}

	return verdict, vr.Reasoning, vr.ROIScore, vr.EmotionalScore, nil
}

func buildEvalPrompt(evalCtx ports.EvalContext) string {
	item := evalCtx.Item
	var sb strings.Builder
	fmt.Fprintf(&sb, "Item: %s\n", item.Title)
	fmt.Fprintf(&sb, "Price: %.2f %s\n", item.Price, item.Currency)
	fmt.Fprintf(&sb, "Impact (self-rated): %d/5\n", item.Impact)
	fmt.Fprintf(&sb, "Total account balance: %.2f\n", evalCtx.TotalBalance)
	if evalCtx.RoleName != "" {
		fmt.Fprintf(&sb, "Associated life role: %s (weight: %.1f/10)\n", evalCtx.RoleName, evalCtx.RoleWeight)
	}
	if evalCtx.GoalTitle != "" {
		progPct := evalCtx.GoalProgress * 100
		fmt.Fprintf(&sb, "Associated goal: %s (progress: %.0f%%)\n", evalCtx.GoalTitle, progPct)
	}
	fmt.Fprintf(&sb, "Cooldown preference: %d days\n", item.CooldownDays)
	return sb.String()
}

// Compile-time interface check.
var _ ports.WishlistAgent = (*WishlistAgent)(nil)
