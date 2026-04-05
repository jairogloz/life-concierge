package middleware

import (
	"log"
	"strings"

	clerkjwt "github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gofiber/fiber/v2"
)

const userIDKey = "authenticated_user_id"

// RequireAuth is a Fiber middleware that verifies the Clerk JWT present in the
// Authorization Bearer header. On success it stores the user's Subject (Clerk
// user_id) in the Fiber context so downstream handlers can retrieve it via GetUserID.
func RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get(fiber.HeaderAuthorization)
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "unauthorized",
					"message": "missing authorization header",
				},
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "unauthorized",
					"message": "authorization header must be of the form 'Bearer <token>'",
				},
			})
		}

		token := parts[1]
		claims, err := clerkjwt.Verify(c.Context(), &clerkjwt.VerifyParams{
			Token: token,
		})
		if err != nil {
			log.Printf("[auth] JWT verification failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "unauthorized",
					"message": "invalid or expired token",
				},
			})
		}

		c.Locals(userIDKey, claims.Subject)
		return c.Next()
	}
}

// GetUserID returns the authenticated user's Clerk user_id from the Fiber context.
// It panics if called outside of a RequireAuth-protected route.
func GetUserID(c *fiber.Ctx) string {
	id, _ := c.Locals(userIDKey).(string)
	return id
}
