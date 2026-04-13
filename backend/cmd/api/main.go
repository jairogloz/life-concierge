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

	roleshttp "github.com/jairogloz/life-concierge/internal/roles/adapters/http"
	rolespostgres "github.com/jairogloz/life-concierge/internal/roles/adapters/postgres"
	rolesapp "github.com/jairogloz/life-concierge/internal/roles/application"

	goalshttp "github.com/jairogloz/life-concierge/internal/goals/adapters/http"
	goalspostgres "github.com/jairogloz/life-concierge/internal/goals/adapters/postgres"
	goalsapp "github.com/jairogloz/life-concierge/internal/goals/application"

	taskshttp "github.com/jairogloz/life-concierge/internal/tasks/adapters/http"
	taskspostgres "github.com/jairogloz/life-concierge/internal/tasks/adapters/postgres"
	tasksapp "github.com/jairogloz/life-concierge/internal/tasks/application"

	rankinghttp "github.com/jairogloz/life-concierge/internal/ranking/adapters/http"
	rankingpostgres "github.com/jairogloz/life-concierge/internal/ranking/adapters/postgres"
	rankingapp "github.com/jairogloz/life-concierge/internal/ranking/application"

	balancehttp "github.com/jairogloz/life-concierge/internal/balance/adapters/http"
	balancepostgres "github.com/jairogloz/life-concierge/internal/balance/adapters/postgres"
	balanceapp "github.com/jairogloz/life-concierge/internal/balance/application"

	dashboardhttp "github.com/jairogloz/life-concierge/internal/dashboard/adapters/http"
	dashboardapp "github.com/jairogloz/life-concierge/internal/dashboard/application"

	inboxcontext "github.com/jairogloz/life-concierge/internal/ai_suggestions/adapters/context"
	inboxhttp "github.com/jairogloz/life-concierge/internal/ai_suggestions/adapters/http"
	inboxopenai "github.com/jairogloz/life-concierge/internal/ai_suggestions/adapters/openai"
	inboxpostgres "github.com/jairogloz/life-concierge/internal/ai_suggestions/adapters/postgres"
	inboxapp "github.com/jairogloz/life-concierge/internal/ai_suggestions/application"
	sharedai "github.com/jairogloz/life-concierge/internal/shared/ai"

	financehttp "github.com/jairogloz/life-concierge/internal/finance/adapters/http"
	financepostgres "github.com/jairogloz/life-concierge/internal/finance/adapters/postgres"
	financeapp "github.com/jairogloz/life-concierge/internal/finance/application"

	wishlcontext "github.com/jairogloz/life-concierge/internal/wishlist/adapters/context"
	wishlhttp "github.com/jairogloz/life-concierge/internal/wishlist/adapters/http"
	wishlopenai "github.com/jairogloz/life-concierge/internal/wishlist/adapters/openai"
	wishlpostgres "github.com/jairogloz/life-concierge/internal/wishlist/adapters/postgres"
	wishlapp "github.com/jairogloz/life-concierge/internal/wishlist/application"

	briefcontext "github.com/jairogloz/life-concierge/internal/daily_brief/adapters/context"
	briefhttp "github.com/jairogloz/life-concierge/internal/daily_brief/adapters/http"
	briefopenaiadapter "github.com/jairogloz/life-concierge/internal/daily_brief/adapters/openai"
	briefapp "github.com/jairogloz/life-concierge/internal/daily_brief/application"

	timelinehttp "github.com/jairogloz/life-concierge/internal/timeline/adapters/http"
	timelinepostgres "github.com/jairogloz/life-concierge/internal/timeline/adapters/postgres"
	timelineapp "github.com/jairogloz/life-concierge/internal/timeline/application"

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
		AppName:        "life-concierge",
		ErrorHandler:   customErrorHandler,
		ReadBufferSize: 16 * 1024,
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(fiberlogger.New(fiberlogger.Config{
		Format: "${time} | ${status} | ${latency} | ${method} ${path} | reqid=${locals:requestid}\n",
	}))

	// ── Routes: public ───────────────────────────────────────────────────────
	app.Get("/health", healthhandler.Handler(db))

	// ── Domain setup ─────────────────────────────────────────────────────────
	rolesRepo := rolespostgres.NewRoleRepository(db)
	rolesService := rolesapp.NewRoleService(rolesRepo)

	goalsRepo := goalspostgres.NewGoalRepository(db)
	goalsService := goalsapp.NewGoalService(goalsRepo)

	tasksRepo := taskspostgres.NewTaskRepository(db)
	tasksService := tasksapp.NewTaskService(tasksRepo)

	rankingRepo := rankingpostgres.NewRankingRepository(db)

	// Balance (Life Balance Score)
	balanceRepo := balancepostgres.NewBalanceRepository(db)
	balanceService := balanceapp.NewBalanceService(balanceRepo)

	rankingService := rankingapp.NewRankingService(rankingRepo, balanceService)

	// Dashboard
	dashboardService := dashboardapp.NewDashboardService(balanceService, rankingService)

	// AI inbox
	openaiClient := sharedai.NewOpenAIClient(cfg.OpenAIAPIKey)
	inboxRepo := inboxpostgres.NewSuggestionRepository(db)
	rolesReader := inboxcontext.NewRolesReader(rolesRepo)
	goalsReader := inboxcontext.NewGoalsReader(goalsRepo)
	taskAgent := inboxopenai.NewTaskAgent(openaiClient, cfg.OpenAIModel)
	inboxService := inboxapp.NewInboxService(inboxRepo, taskAgent, rolesReader, goalsReader, tasksService)

	// Finance
	financeRepo := financepostgres.NewFinanceRepository(db)
	financeService := financeapp.NewFinanceService(financeRepo)

	// Wishlist
	wishlRepo := wishlpostgres.NewWishlistRepository(db)
	wishlAgent := wishlopenai.NewWishlistAgent(openaiClient, cfg.OpenAIModel)
	wishlRoles := wishlcontext.NewRolesReader(rolesRepo)
	wishlGoals := wishlcontext.NewGoalsReader(goalsRepo)
	wishlFinance := wishlcontext.NewFinanceReader(financeRepo)
	wishlService := wishlapp.NewWishlistService(wishlRepo, wishlAgent, wishlRoles, wishlGoals, wishlFinance)

	// Timeline
	timelineRepo := timelinepostgres.NewTimelineRepository(db)
	timelineService := timelineapp.NewTimelineService(timelineRepo)
	tasksService.SetTimeline(timelineService)
	financeService.SetTimeline(timelineService)
	wishlService.SetTimeline(timelineService)

	// Daily Brief
	briefTimeline := briefcontext.NewTimelineReader(timelineRepo)
	briefGoals := briefcontext.NewGoalsReader(goalsRepo)
	briefRoles := briefcontext.NewRolesReader(rolesRepo)
	briefFinance := briefcontext.NewFinanceReader(financeRepo)
	briefAgent := briefopenaiadapter.NewStrategyAgent(openaiClient, cfg.OpenAIModel)
	briefService := briefapp.NewDailyBriefService(briefTimeline, briefGoals, briefRoles, briefFinance, briefAgent)

	// ── Routes: authenticated API v1 ─────────────────────────────────────────
	// All routes under /api/v1 require a valid Clerk JWT.
	api := app.Group("/api/v1", middleware.RequireAuth())
	// balance must be registered before roles so /roles/balance is not
	// swallowed by the parametric /roles/:id route.
	balancehttp.RegisterRoutes(api, balanceService)
	dashboardhttp.RegisterRoutes(api, dashboardService)
	roleshttp.RegisterRoutes(api, rolesService)
	goalshttp.RegisterRoutes(api, goalsService)
	// ranking and inbox registered BEFORE tasks so /tasks/ranked and /tasks/inbox
	// are matched as static paths before the parametric /tasks/:id route.
	rankinghttp.RegisterRoutes(api, rankingService)
	inboxhttp.RegisterRoutes(api, inboxService)
	taskshttp.RegisterRoutes(api, tasksService)
	financehttp.RegisterRoutes(api, financeService)
	wishlhttp.RegisterRoutes(api, wishlService)
	timelinehttp.RegisterRoutes(api, timelineService)
	briefhttp.RegisterRoutes(api, briefService)

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
	log.Printf("[error] %s %s → %d: %v", c.Method(), c.Path(), code, err)
	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{
			"code":    "error",
			"message": err.Error(),
		},
	})
}
