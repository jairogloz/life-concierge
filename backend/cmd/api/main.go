package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	clerkSDK "github.com/clerk/clerk-sdk-go/v2"
	"github.com/gofiber/fiber/v2"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"

	"github.com/jairogloz/life-concierge/internal/shared/config"
	"github.com/jairogloz/life-concierge/internal/shared/database"
	healthhandler "github.com/jairogloz/life-concierge/internal/shared/handlers/health"
	"github.com/jairogloz/life-concierge/internal/shared/middleware"
)

func main() {
	// ── Configuration ───────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	// ── Clerk ────────────────────────────────────────────────────────────────
	clerkSDK.SetKey(cfg.ClerkSecretKey)

	// ── Database ─────────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	log.Println("database connection established")

	// ── Fiber app ────────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "life-concierge",
		ErrorHandler: customErrorHandler,
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(fiberlogger.New(fiberlogger.Config{
		Format: "${time} | ${status} | ${latency} | ${method} ${path} | reqid=${locals:requestid}\n",
	}))

	// ── Routes: public ───────────────────────────────────────────────────────
	app.Get("/health", healthhandler.Handler(db))

	// ── Routes: authenticated API v1 ─────────────────────────────────────────
	// All routes under /api/v1 require a valid Clerk JWT.
	_ = app.Group("/api/v1", middleware.RequireAuth())
	// Domain routes registered here in subsequent phases:
	// roles.RegisterRoutes(api, db)
	// goals.RegisterRoutes(api, db)
	// tasks.RegisterRoutes(api, db)

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("server starting on port %s (env=%s)\n", cfg.Port, cfg.Env)
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Fatalf("server: %v", err)
		}
	}()

	<-quit
	log.Println("shutting down server…")
	if err := app.ShutdownWithTimeout(5 * time.Second); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("server stopped")
}

// customErrorHandler returns JSON error responses for unhandled errors.
func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{
			"code":    "error",
			"message": err.Error(),
		},
	})
}
