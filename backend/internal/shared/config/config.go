package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port           string
	Env            string
	DatabaseURL    string
	ClerkSecretKey string
	OpenAIAPIKey   string
	OpenAIModel    string
}

// Load reads configuration from the environment.
// In non-production environments it also attempts to load a .env file from the
// working directory (or the directory passed via envFile).
func Load() (*Config, error) {
	// Best-effort load of .env — ignore error if file does not exist
	_ = godotenv.Load()

	cfg := &Config{
		Port:           getEnv("PORT", "3000"),
		Env:            getEnv("ENV", "development"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		ClerkSecretKey: os.Getenv("CLERK_SECRET_KEY"),
		OpenAIAPIKey:   os.Getenv("OPENAI_API_KEY"),
		OpenAIModel:    getEnv("OPENAI_MODEL", "gpt-4o"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.ClerkSecretKey == "" {
		// In production this should be a hard error; during local dev the public
		// /health endpoint still works and auth-protected routes return 401.
		fmt.Println("warning: CLERK_SECRET_KEY is not set — authenticated routes will reject all requests")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
