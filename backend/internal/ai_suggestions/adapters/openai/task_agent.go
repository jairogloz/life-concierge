package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/sashabaranov/go-openai"

	"github.com/jairogloz/life-concierge/internal/ai_suggestions/domain"
	"github.com/jairogloz/life-concierge/internal/ai_suggestions/ports"
)

// TaskAgent uses OpenAI to extract structured task data from raw text.
type TaskAgent struct {
	client *openai.Client
	model  string
}

// NewTaskAgent creates a new OpenAI-backed task agent.
func NewTaskAgent(client *openai.Client, model string) *TaskAgent {
	return &TaskAgent{client: client, model: model}
}

func (a *TaskAgent) Extract(ctx context.Context, _ string, rawText string, roles []ports.RoleContext, goals []ports.GoalContext) (*domain.TaskSuggestion, error) {
	systemPrompt := buildSystemPrompt(roles, goals)
	userMessage := fmt.Sprintf("Extract a task from this text: %s", rawText)

	resp, err := a.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: a.model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: userMessage},
		},
		ResponseFormat: &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		},
		MaxTokens: 512,
	})
	if err != nil {
		return nil, fmt.Errorf("openai: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("openai: no choices in response")
	}

	var suggestion domain.TaskSuggestion
	if err := json.Unmarshal([]byte(resp.Choices[0].Message.Content), &suggestion); err != nil {
		return nil, fmt.Errorf("openai: parse response: %w", err)
	}
	return &suggestion, nil
}

func buildSystemPrompt(roles []ports.RoleContext, goals []ports.GoalContext) string {
	var sb strings.Builder
	sb.WriteString(`You are a personal operating system assistant. Extract a structured task from the user's text.\n\n`)
	sb.WriteString("Return ONLY a valid JSON object with these fields:\n")
	sb.WriteString(`{"title":"string","description":"string","role_id":"string","goal_id":"string or null","task_type":"one_time|daily","impact":3,"context_tags":[],"deadline_hint":"ISO date string or null"}\n\n`)

	if len(roles) > 0 {
		sb.WriteString("Available roles (pick the most appropriate role_id):\n")
		for _, r := range roles {
			fmt.Fprintf(&sb, "- id=%s name=%s\n", r.ID, r.Name)
		}
	}
	if len(goals) > 0 {
		sb.WriteString("\nAvailable goals (pick a goal_id if relevant):\n")
		for _, g := range goals {
			fmt.Fprintf(&sb, "- id=%s title=%s role=%s\n", g.ID, g.Title, g.RoleID)
		}
	}
	sb.WriteString("\nimpact must be an integer from 1 (very low) to 5 (very high). task_type must be one of: one_time, daily. Use daily only for habits or recurring activities.")
	return sb.String()
}

// Ensure TaskAgent satisfies the port interface at compile time.
var _ ports.TaskAgent = (*TaskAgent)(nil)
