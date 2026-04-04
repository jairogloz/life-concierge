package response

import "github.com/gofiber/fiber/v2"

// ErrorBody is the standard error envelope returned by all API endpoints.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error writes a JSON error response with the given HTTP status, code, and
// human-readable message.
func Error(c *fiber.Ctx, status int, code, message string) error {
	return c.Status(status).JSON(fiber.Map{
		"error": ErrorBody{Code: code, Message: message},
	})
}

// BadRequest is a convenience wrapper for 400 responses.
func BadRequest(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusBadRequest, "bad_request", message)
}

// NotFound is a convenience wrapper for 404 responses.
func NotFound(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusNotFound, "not_found", message)
}

// InternalError is a convenience wrapper for 500 responses.
func InternalError(c *fiber.Ctx) error {
	return Error(c, fiber.StatusInternalServerError, "internal_error", "an unexpected error occurred")
}
