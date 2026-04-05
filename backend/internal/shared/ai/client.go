package ai

import (
	"github.com/sashabaranov/go-openai"
)

// NewOpenAIClient creates a new OpenAI client using the provided API key.
func NewOpenAIClient(apiKey string) *openai.Client {
	return openai.NewClient(apiKey)
}
