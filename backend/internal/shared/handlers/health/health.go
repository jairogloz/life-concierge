package health

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler returns a Fiber handler for the GET /health endpoint.
// It reports the server status and checks database connectivity.
func Handler(db *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		dbStatus := "connected"

		ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			dbStatus = "unreachable"
		}

		status := fiber.StatusOK
		if dbStatus != "connected" {
			status = fiber.StatusServiceUnavailable
		}

		return c.Status(status).JSON(fiber.Map{
			"status": "ok",
			"db":     dbStatus,
		})
	}
}
