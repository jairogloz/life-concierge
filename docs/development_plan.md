# Personal Operating System — Development Plan

> **Legend:**
>
> - `⬜` Not started
> - `🔄` In progress
> - `✅` Done
> - `🔑` Requires manual action (external service, secret, or account setup)

---

## Phase 0 — Repository Scaffolding & External Services

_Goal: Working monorepo skeleton with all external accounts ready before writing a single line of domain logic._

- ✅ Create top-level monorepo folder structure:
  ```
  life-concierge/
  ├── backend/
  ├── frontend-web/
  ├── frontend-mobile/
  ├── shared-types/
  ├── infra/
  └── docs/
  ```
- ✅ Add root `.gitignore` covering Go, Node, Expo, `.env` files
- ✅ Add root `README.md` with project overview
- ✅ `infra/docker-compose.yml` — local PostgreSQL for development

### External Services (manual steps required)

- 🔑 **Railway** — Create a new Railway project, provision a PostgreSQL plugin, copy `DATABASE_URL`
- 🔑 **Clerk** — Create a new Clerk application (set JWT template to include `user_id`), copy `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
- 🔑 **OpenAI** — Create API key for AI agent integration, copy `OPENAI_API_KEY`
- ✅ `backend/.env.example` documenting all required env vars
- ✅ `backend/.env` created locally (git-ignored) — **fill in your Clerk + OpenAI keys**

---

## Phase 1 — Backend Foundation

_Goal: Running Go/Fiber server with DB connection, auth middleware, and `/health` endpoint testable immediately._

### Project Setup

- ✅ `backend/go.mod` — `module github.com/jairogloz/life-concierge`, `go 1.25`
- ✅ Core dependencies added to `go.mod`:
  - `github.com/gofiber/fiber/v2`
  - `github.com/clerk/clerk-sdk-go/v2`
  - `github.com/golang-migrate/migrate/v4`
  - `github.com/jackc/pgx/v5`
  - `github.com/joho/godotenv`
- ✅ `backend/cmd/api/main.go` — entry point: load config, connect DB, register routes, start Fiber
- ✅ `backend/internal/shared/config/config.go` — env var loading struct
- ✅ `backend/internal/shared/database/postgres.go` — pgx pool construction + ping
- ✅ `backend/.air.toml` — hot-reload config for development
- ✅ `backend/Makefile` — targets: `run`, `build`, `migrate-up`, `migrate-down`, `test`

### Migrations Infrastructure

- ✅ `backend/migrations/000001_init.up.sql` — enable `uuid-ossp` extension
- ✅ `backend/migrations/000001_init.down.sql`

### Auth Middleware

- ✅ `backend/internal/shared/middleware/auth.go` — Clerk JWT verification
- ✅ `GetUserID(c)` helper to extract authenticated `user_id` from Fiber context

### Standard Response Helpers

- ✅ `backend/internal/shared/response/response.go` — `Error`, `BadRequest`, `NotFound`, `InternalError`

### Health Endpoint

- ✅ `backend/internal/shared/handlers/health/health.go`
- ✅ `GET /health` — returns `{ "status": "ok", "db": "connected" }`

### ✅ Testable milestone — VERIFIED

```bash
make -C backend run
curl http://localhost:3000/health
# → {"db":"connected","status":"ok"}

curl http://localhost:3000/api/v1/roles
# → {"error":{"code":"unauthorized","message":"missing authorization header"}}
```

---

## Phase 2 — Roles Domain

_Goal: Full CRUD for roles — first domain end-to-end through hexagonal layers._

### Database

- ✅ `backend/migrations/000002_create_roles.up.sql`
- ✅ `backend/migrations/000002_create_roles.down.sql`

### Domain Layer

- ✅ `backend/internal/roles/domain/role.go` — `Role` struct + validation

### Ports (Interfaces)

- ✅ `backend/internal/roles/ports/input.go` — `RoleService` interface
- ✅ `backend/internal/roles/ports/output.go` — `RoleRepository` interface

### Adapters

- ✅ `backend/internal/roles/adapters/postgres/repository.go`
- ✅ `backend/internal/roles/adapters/http/handler.go`

### Application

- ✅ `backend/internal/roles/application/service.go`

### API Routes (all protected by auth middleware)

- ✅ `POST   /api/v1/roles`
- ✅ `GET    /api/v1/roles`
- ✅ `GET    /api/v1/roles/:id`
- ✅ `PUT    /api/v1/roles/:id`
- ✅ `DELETE /api/v1/roles/:id`

### Tests

- ⬜ Unit tests for `RoleService` (mock repository)
- ⬜ Integration test for `RoleRepository` (test DB)

### ✅ Testable milestone

```bash
curl -X POST http://localhost:3000/api/v1/roles \
  -H "Authorization: Bearer <clerk_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineer","weight":1.4,"color":"#4F86C6"}'
```

---

## Phase 3 — Goals Domain

_Goal: Hierarchical goals linked to roles._

### Database

- ✅ `backend/migrations/000003_create_goals.up.sql` — goals table with `parent_goal_id` self-reference
- ✅ `backend/migrations/000003_create_goals.down.sql`

### Domain, Ports, Adapters, Application, Routes

- ✅ Same hexagonal structure as Roles domain
- ✅ `POST   /api/v1/goals`
- ✅ `GET    /api/v1/goals`
- ✅ `GET    /api/v1/goals/:id`
- ✅ `PUT    /api/v1/goals/:id`
- ✅ `DELETE /api/v1/goals/:id`
- ✅ `GET    /api/v1/roles/:roleId/goals`

### Tests

- ⬜ Unit + integration tests

### ✅ Testable milestone: Create a goal linked to a role, fetch it back with parent/child hierarchy

---

## Phase 4 — Tasks Domain

_Goal: Full task CRUD with all spec fields — foundation for the ranking engine._

### Database

- ✅ `backend/migrations/000004_create_tasks.up.sql`:
  - All spec fields: `commitment_type` ENUM, `context_tags TEXT[]`, deadlines, recurrence
  - Junction table `task_secondary_roles(task_id, role_id)`
- ✅ `backend/migrations/000004_create_tasks.down.sql`

### Domain, Ports, Adapters, Application, Routes

- ✅ Same hexagonal structure
- ✅ `POST   /api/v1/tasks`
- ✅ `GET    /api/v1/tasks` (with filters: role, goal, status, context)
- ✅ `GET    /api/v1/tasks/:id`
- ✅ `PUT    /api/v1/tasks/:id`
- ✅ `DELETE /api/v1/tasks/:id`
- ✅ `PATCH  /api/v1/tasks/:id/complete`

### Tests

- ⬜ Unit + integration tests

### ✅ Testable milestone: Create tasks with all fields, filter by role/goal, mark complete

---

## Phase 5 — Ranking Engine

_Goal: The product core — call one endpoint, get a prioritized list of what to do next._

### Implementation

- ✅ `backend/internal/ranking/domain/scorer.go` — pure scoring function:
  ```
  score = role_weight × goal_weight × urgency × deadline_pressure × commitment_multiplier
  ```
- ✅ `deadline_pressure` — exponential decay toward deadline
- ✅ `commitment_multiplier` — commitment=2.0, habit=1.5, recurring=1.3, intention=1.0
- ⬜ `anti_deferral_penalty` — reduces score for tasks deferred multiple times
- ✅ `context_match` — optional query param filtering

### API Routes

- ✅ `GET /api/v1/tasks/ranked` — global ranked list (`?limit=10&context=`)
- ✅ `GET /api/v1/roles/:id/tasks/ranked` — per-role ranked list

### Tests

- ⬜ Unit tests for scorer with known inputs → expected rank order

### ✅ Testable milestone

```bash
curl "http://localhost:3000/api/v1/tasks/ranked?limit=5&energy=high" \
  -H "Authorization: Bearer <clerk_jwt>"
# → tasks ordered by computed priority score
```

---

## Phase 6 — AI Integration (Task Agent + Inbox)

_Goal: Drop raw text, get a fully structured task ready for review._

### Setup

- ✅ `backend/internal/shared/ai/client.go` — OpenAI client wrapper (`gpt-4o`)
- ✅ `backend/migrations/000005_create_ai_suggestions.up.sql`
- ✅ `backend/internal/ai_suggestions/` domain — permanent AI suggestion store

### Task Agent

- ✅ `backend/internal/ai_suggestions/adapters/openai/task_agent.go`
  - Input: `raw_text string` + user's roles + goals as context
  - Output: partially populated `TaskSuggestion` struct for user review
- ✅ `POST /api/v1/tasks/inbox` — accepts `{"raw_text":"..."}`, returns suggestion
- ✅ `POST /api/v1/tasks/inbox/:id/accept` — creates real task
- ✅ `POST /api/v1/tasks/inbox/:id/reject`

### Tests

- ✅ Unit tests with mocked AI client (service + HTTP handler, 18 tests)
- ⬜ Manual integration test with real API key 🔑

### ✅ Testable milestone

```bash
curl -X POST http://localhost:3000/api/v1/tasks/inbox \
  -H "Authorization: Bearer <clerk_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"Call mom this Sunday, important for marriage role"}'
# → structured task suggestion with role + deadline mapped
```

---

## Phase 7 — Frontend Web MVP

_Goal: Usable browser UI exercising all backend endpoints built so far._

### Scaffold

- ✅ `cd frontend-web && npm create vite@latest . -- --template react-ts`
- ✅ Install: `@clerk/clerk-react`, `react-router-dom`, `axios`, `tailwindcss`
- ✅ Set `VITE_CLERK_PUBLISHABLE_KEY` in `frontend-web/.env`

### Auth

- ✅ Wrap app in `<ClerkProvider>`
- ✅ Sign-in / Sign-up pages using Clerk components
- ✅ Protected route wrapper (`src/components/ProtectedRoute.tsx`)
- ✅ API client that auto-attaches Clerk JWT to every request (`src/lib/useApi.ts`)

### Pages

- ✅ **Today Dashboard** (`/`) — `GET /api/v1/tasks/ranked`, renders prioritized list
- ✅ **Roles** (`/roles`) — CRUD with weight slider
- ✅ **Goals** (`/goals`) — list by role, hierarchy view
- ✅ **Tasks** (`/tasks`) — list with filters, create, edit, mark complete
- ✅ **Quick Capture** (`/inbox`) — floating input → AI inbox → accept / reject
- ✅ Basic responsive sidebar layout

### ✅ Testable milestone: Full daily workflow in browser — capture, rank, complete

---

## Phase 8 — Frontend Mobile MVP

_Goal: Core daily workflow available on phone._

### Scaffold

- ✅ `cd frontend-mobile && npx create-expo-app@latest . --template blank-typescript`
- ✅ Install: `@clerk/clerk-expo`, `expo-secure-store`, `expo-router`, `axios`
- ✅ Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `frontend-mobile/.env`

### Auth

- ✅ Clerk Expo token cache via `expo-secure-store`
- ✅ Sign-in screen (`/(auth)/sign-in`)
- ✅ Protected navigation (root layout auto-redirects by sign-in state)

### Screens

- ✅ **Today** (Home tab) — ranked tasks, pull-to-refresh, tap to complete
- ✅ **Quick Capture** (Capture tab) — text note → AI parse → accept/reject
- ✅ **Roles** tab — full CRUD with weight bar, bottom-sheet modal
- ✅ Tab navigation (Today / Capture / Roles)

### ✅ Testable milestone: Open app on phone, sign in, see ranked tasks, quick-capture a new task

---

## Phase 9 — Finance Domain

_Goal: Full ledger — accounts, transactions, categories, splits, transfers._

### Database

- ⬜ `backend/migrations/0006_create_finance.up.sql`:
  - `accounts` — id, user_id, name, type ENUM, currency, balance
  - `transactions` — id, account_id, amount, currency, category, role_id, description, date
  - `transfers` — id, from_account_id, to_account_id, amount, currency, date
  - `transaction_splits` — id, transaction_id, category, amount, percentage

### Domain, Ports, Adapters, Application, Routes

- ⬜ Same hexagonal structure for `finance` domain
- ⬜ `POST/GET /api/v1/accounts`
- ⬜ `POST/GET /api/v1/transactions` (with split support)
- ⬜ `POST     /api/v1/transfers`
- ⬜ `GET      /api/v1/finance/summary`

### Frontend (Web + Mobile)

- ⬜ Accounts overview screen
- ⬜ Log transaction form with split UI
- ⬜ Transfer form

### ✅ Testable milestone: Log a split transaction (60% groceries / 40% household), verify account balance

---

## Phase 10 — Wishlist Decision Engine

_Goal: Submit a potential purchase, get an AI-powered buy/wait/reject/replace verdict._

### Database

- ⬜ `backend/migrations/0007_create_wishlist.up.sql`:
  - `wishlist_items` — id, user_id, title, price, currency, role_id, goal_id,
    importance, roi_score, emotional_score, cooldown_days, verdict, verdict_reasoning, evaluated_at

### Finance Agent

- ⬜ `backend/internal/finance/adapters/ai/wishlist_agent.go`
  - Reads: account balances, goal alignment, role weight, item fields
  - Outputs verdict: `buy_now | wait | reject | replace`
  - Stores result in `ai_suggestions` + updates item verdict
- ⬜ `POST /api/v1/wishlist`
- ⬜ `GET  /api/v1/wishlist`
- ⬜ `POST /api/v1/wishlist/:id/evaluate`

### Frontend

- ⬜ Wishlist screen with verdict badges

### ✅ Testable milestone: Submit "noise-cancelling headphones $350" → AI verdict with reasoning

---

## Phase 11 — Health Domain

_Goal: Log workouts and body metrics; framework for future wearable integrations._

### Database

- ⬜ `backend/migrations/0008_create_health.up.sql`:
  - `workout_sessions` — id, user_id, date, duration_minutes, intensity, goal_alignment, notes
  - `exercise_entries` — id, session_id, exercise_name, details JSONB
  - `body_metrics` — id, user_id, date, weight_kg, body_fat_pct, waist_cm, vo2_estimate, resting_hr

### Domain, Ports, Adapters, Application, Routes

- ⬜ `POST/GET /api/v1/workouts`
- ⬜ `POST/GET /api/v1/workouts/:id/exercises`
- ⬜ `POST/GET /api/v1/body-metrics`
- ⬜ `GET      /api/v1/health/summary`

### Health Agent

- ⬜ `backend/internal/health/adapters/ai/health_agent.go` — training recommendations

### Frontend

- ⬜ Log workout screen (session + exercises)
- ⬜ Body metrics trend chart

### ✅ Testable milestone: Log a workout with exercises, view trend chart, get training recommendation

---

## Phase 12 — Timeline Domain & Daily Strategy Agent

_Goal: Record every significant life event; power adaptive recommendations._

### Database

- ⬜ `backend/migrations/0009_create_timeline.up.sql`:
  - `timeline_events` — id, user_id, event_type, domain, entity_id UUID, payload JSONB, occurred_at

### Implementation

- ⬜ `backend/internal/timeline/` domain — event recording service
- ⬜ Emit timeline events from all other domains:
  - task_completed, expense_logged, wishlist_evaluated, workout_recorded, role_updated
- ⬜ `GET /api/v1/timeline` — paginated event history

### Daily Strategy Agent

- ⬜ `backend/internal/ai/daily_strategy_agent.go` — supervisor agent
  - Reads: 30-day timeline + current goals + role weights
  - Produces: top 3 actions, 1 finance alert, 1 health nudge
- ⬜ `GET /api/v1/ai/daily-brief`

### Frontend

- ⬜ Timeline feed screen
- ⬜ Daily briefing card on Today dashboard

### ✅ Testable milestone: After 1 week of usage, `/ai/daily-brief` returns context-aware recommendations

---

## Phase 13 — Gamification

_Goal: Engagement layer without distorting real priorities._

- ⬜ `backend/migrations/0010_create_gamification.up.sql` — `user_streaks`, `xp_log`, `achievements`
- ⬜ Consistency bonus calculation (feeds into ranking engine's `consistency_bonus`)
- ⬜ Streak tracking per role and globally
- ⬜ XP awards: task completion, workout logged, budget maintained
- ⬜ Achievement unlock system ("7-day streak", "first investment logged", etc.)
- ⬜ `GET /api/v1/gamification/profile`
- ⬜ Gamification widgets on Today dashboard + mobile home screen

### ✅ Testable milestone: Complete 3 tasks in a day, see XP and streak update

---

## Infrastructure & Cross-Cutting Concerns

### CI/CD

- ⬜ `.github/workflows/test.yml` — lint + test on PR
- ⬜ `.github/workflows/deploy.yml` — deploy backend to Railway on push to `main`
- 🔑 Set GitHub Actions secrets: `RAILWAY_TOKEN`, `CLERK_SECRET_KEY`, `DATABASE_URL`

### Observability

- ⬜ Structured JSON logging (Fiber logger middleware)
- ⬜ Request ID middleware
- ⬜ Standard error response format: `{"error":{"code":"...","message":"..."}}`

### `shared-types/`

- ⬜ `npm init` — TypeScript package
- ⬜ Shared API request/response types consumed by both frontends
- ⬜ `tsconfig.json` + build pipeline

---

## Summary Table

| Phase | Description                            | Status |
| ----- | -------------------------------------- | ------ |
| 0     | Repo scaffold + external services      | ✅     |
| 1     | Backend foundation (Fiber + DB + auth) | ✅     |
| 2     | Roles domain                           | ✅     |
| 3     | Goals domain                           | ✅     |
| 4     | Tasks domain                           | ✅     |
| 5     | Ranking engine                         | ✅     |
| 6     | AI task agent + inbox                  | ✅     |
| 7     | Frontend web MVP                       | ✅     |
| 8     | Frontend mobile MVP                    | ⬜     |
| 9     | Finance domain                         | ⬜     |
| 10    | Wishlist decision engine               | ⬜     |
| 11    | Health domain                          | ⬜     |
| 12    | Timeline + daily strategy agent        | ⬜     |
| 13    | Gamification                           | ⬜     |
