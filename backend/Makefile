BINARY_NAME=life-concierge
CMD_PATH=./cmd/api
MIGRATIONS_DIR=./migrations
DB_URL?=$(shell grep DATABASE_URL .env | cut -d '=' -f2-)

.PHONY: run build test migrate-up migrate-down migrate-create lint clean

## run: start the API server (auto-reloads on change if air is installed)
run:
	@if command -v air > /dev/null 2>&1; then \
		air -c .air.toml; \
	else \
		go run $(CMD_PATH)/main.go; \
	fi

## build: compile the binary to ./bin/
build:
	@mkdir -p bin
	go build -o bin/$(BINARY_NAME) $(CMD_PATH)/main.go

## test: run all tests with race detector
test:
	go test -race -timeout 120s ./...

## test/cover: run tests and open HTML coverage report
test/cover:
	go test -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out

## migrate-up: apply all pending migrations
migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" up

## migrate-down: roll back the last migration
migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" down 1

## migrate-create: create a new migration pair (usage: make migrate-create name=my_migration)
migrate-create:
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)

## lint: run golangci-lint
lint:
	golangci-lint run ./...

## clean: remove compiled binaries and coverage files
clean:
	rm -rf bin/ coverage.out

## tidy: tidy go modules
tidy:
	go mod tidy
