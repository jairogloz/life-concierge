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

- ✅ `backend/migrations/0006_create_finance.up.sql`:
  - `accounts` — id, user_id, name, type ENUM, currency, balance
  - `transactions` — id, account_id, amount, currency, category, role_id, description, date
  - `transfers` — id, from_account_id, to_account_id, amount, currency, date
  - `transaction_splits` — id, transaction_id, category, amount, percentage

### Domain, Ports, Adapters, Application, Routes

- ✅ Same hexagonal structure for `finance` domain
- ✅ `POST/GET /api/v1/accounts`
- ✅ `POST/GET /api/v1/transactions` (with split support)
- ✅ `POST     /api/v1/transfers`
- ✅ `GET      /api/v1/finance/summary`

### Frontend (Web + Mobile)

- ✅ Accounts overview screen
- ✅ Log transaction form with split UI
- ✅ Transfer form

### ✅ Testable milestone: Log a split transaction (60% groceries / 40% household), verify account balance

---

## Phase 10 — Wishlist Decision Engine

_Goal: Submit a potential purchase, get an AI-powered buy/wait/reject/replace verdict._

### Database

- ✅ `backend/migrations/000007_create_wishlist.up.sql`:
  - `wishlist_items` — id, user_id, title, price, currency, role_id, goal_id,
    importance, roi_score, emotional_score, cooldown_days, verdict, verdict_reasoning, evaluated_at

### Wishlist Agent (hexagonal)

- ✅ `backend/internal/wishlist/adapters/openai/wishlist_agent.go`
  - Reads: account balances, goal alignment, role weight, item fields
  - Outputs verdict: `buy_now | wait | reject | replace`
  - Updates item verdict + roi_score + emotional_score
- ✅ `POST /api/v1/wishlist`
- ✅ `GET  /api/v1/wishlist`
- ✅ `POST /api/v1/wishlist/:id/evaluate`

### Frontend

- ✅ Wishlist screen with verdict badges (web + mobile)

### ✅ Testable milestone: Submit "noise-cancelling headphones $350" → AI verdict with reasoning

---

## Phase 11 — Timeline Domain & Daily Strategy Agent

_Goal: Record every significant life event; power adaptive recommendations._

### Database

- ✅ `backend/migrations/000008_create_timeline.up.sql`:
  - `timeline_events` — id, user_id, event_type, domain, entity_id UUID, payload JSONB, occurred_at

### Implementation

- ✅ `backend/internal/timeline/` domain — event recording service
- ✅ Emit timeline events from all other domains:
  - task_completed, expense_logged, wishlist_evaluated, role_updated, goal_updated
- ✅ `GET /api/v1/timeline` — paginated event history

### Daily Strategy Agent

- ✅ `backend/internal/daily_brief/` — supervisor agent
  - Reads: 30-day timeline + current goals + role weights + finance balance
  - Produces: top 3 actions, 1 finance alert, 1 health nudge
- ✅ `GET /api/v1/ai/daily-brief`

### Frontend

- ✅ Timeline feed screen (web + mobile)
- ✅ Daily briefing card on Today dashboard

### ✅ Testable milestone: After 1 week of usage, `/ai/daily-brief` returns context-aware recommendations

---

## Phase 12 — Task Model v2

_Goal: Enrich the task domain with impact, effort, time estimation, scheduling, task types, and tag autocomplete. These fields are prerequisites for the proper scoring engine in Phase 13._

### Schema changes

- ✅ `backend/migrations/000009_task_model_v2.up.sql`:
  - Rename column `urgency` → `impact` (`SMALLINT NOT NULL DEFAULT 3`, range 1–5)
  - Drop `commitment_type` ENUM, add `task_type` ENUM: `one_time | daily`
  - Add `scheduled_date DATE` — when the user intends to work on it
  - Keep existing `deadline` as the hard due-date; add `soft_deadline DATE` (warn-by date)
  - Add `effort SMALLINT NOT NULL DEFAULT 3` (1–5 scale)
  - Add `estimated_minutes INTEGER` — parsed from "1h 30m" syntax on the frontend
  - For **daily** tasks: add `completion_log JSONB DEFAULT '[]'` — array of `{"date": "YYYY-MM-DD", "done": true/false}` entries to track per-day status for statistics
- ✅ `backend/migrations/000009_task_model_v2.down.sql`

### Backend

- ✅ Update `tasks/domain/task.go` — new fields, `impact` label map (1=very low … 5=very high)
- ✅ Update `tasks/ports/*` — new create/update params (`TaskType`, `Impact`, `Effort`, `EstimatedMinutes`, `ScheduledDate`, `SoftDeadline`, `CompletionLog`)
- ✅ Update `tasks/adapters/postgres/repository.go` — read/write new columns
- ✅ Update `tasks/application/service.go`:
  - `CompleteTask` for daily tasks: append today to `completion_log` rather than setting status=done
  - Expose `GetTaskTags(ctx, userID) ([]string, error)` — distinct tags for autocomplete
- ✅ New endpoint `GET /api/v1/tasks/tags` — returns all distinct tags for the authenticated user (autocomplete source)

### Ranking engine changes (scoring input only — formula improvements in Phase 13)

- ✅ Update scorer to use `impact` instead of `urgency`
- ✅ Factor `scheduled_date`: boost score on scheduled day; suppress score on other days (configurable)
- ✅ Factor `soft_deadline` / `deadline`: increase deadline pressure as both dates approach, with hard deadline having higher weight than soft
- ✅ ROI pre-computation: `roi = impact / sqrt(max(15, estimated_minutes))`; store as derived read field

### API additions

- ✅ `GET /api/v1/tasks/tags` — distinct user tags (for autocomplete)

### Frontend — Task form changes (web + mobile)

- ✅ Replace urgency input with **Impact** dropdown: 1 Very Low / 2 Low / 3 Medium / 4 High / 5 Very High
- ✅ Replace commitment type with **Task type** dropdown: `one_time` | `daily`
- ✅ Add **Effort** dropdown (1–5, same labels as impact)
- ✅ Add **Estimated time** text input — accepts "1h", "30m", "1h 30m"; parse on submit to `estimated_minutes`
- ✅ Add **Scheduled date** date picker
- ✅ **Due date** replaces the single "deadline" input; show both soft and hard deadline pickers
- ✅ **Tag autocomplete**: on typing, fetch `/tasks/tags` and show suggestions; if no match → "Create tag" option that adds it in place
- ✅ Daily tasks in the Today view: show streak/calendar dot indicators using `completion_log` data

### Frontend — AI Inbox edit-in-place

- ✅ After AI returns a task suggestion, show all fields in an editable form (pre-populated)
- ✅ User can modify any field before accepting — NOT just accept/reject
- ✅ "Save & Accept" submits the edited version; "Reject" discards as before

### ✅ Testable milestone: Create a daily task, complete it 3 days in a row, see streak dots; create an AI task, edit its title and due date before accepting

---

## Phase 13 — Execution Priority Score & Life Balance Score

_Goal: Replace the simple ranking formula with two independent, explainable scoring systems that reflect real life tradeoffs between importance, effort, urgency, deadlines, role neglect, and goals._

> These two systems are **conceptually separate** and must never be collapsed into one score.
>
> - **Life Balance Score** answers: _"Which areas of life are under-served?"_
> - **Execution Priority Score** answers: _"What is the right next action?"_

### Domain model extensions (migrations)

- ⬜ `backend/migrations/000010_scoring_extensions.up.sql`:
  - `roles`: add `maintenance_floor FLOAT DEFAULT 0.1`, `decay_rate FLOAT DEFAULT 0.05`
  - `goals`: add `weight FLOAT NOT NULL DEFAULT 1.0`, `target_horizon DATE`, `minimum_cadence INTEGER` (days)
  - `tasks`: add `substantiveness_score FLOAT`, `resistance_score FLOAT`, `completion_quality FLOAT`, `completed_at TIMESTAMPTZ`
- ⬜ `backend/migrations/000010_scoring_extensions.down.sql`

### System 1 — Life Balance Score

_Measures whether each role receives enough meaningful investment._

#### Formula

```
life_balance_score(role) = actual_role_contribution / expected_role_contribution
```

#### Actual contribution (rolling 14-day window, completed tasks only)

```
task_contribution =
  role_weight × goal_weight × impact × commitment_multiplier
  × substantiveness_multiplier × completion_quality × timeliness_multiplier

actual_role_contribution = Σ task_contribution
```

#### Expected contribution

```
expected = baseline_expected
         + backlog_pressure_component  (capped at 1.5 × baseline)
         + deadline_pressure_component
         + maintenance_floor

baseline_expected = normalized_role_weight × total_capacity_window
backlog_pressure  = Σ (open_task_value × backlog_factor)
deadline_pressure = Σ weighted_near_deadline_tasks
```

#### Implementation

- ✅ `backend/internal/balance/domain/score.go` — `RoleBalanceScore` struct with `Actual`, `Expected`, `RawScore`, `DisplayPct`, `Explanations`
- ✅ `backend/internal/balance/application/service.go` — pure computation, no I/O side effects
- ✅ `backend/internal/balance/ports/input.go` — `BalanceService` interface
- ✅ `backend/internal/balance/adapters/http/handler.go`
- ✅ `GET /api/v1/roles/balance` — returns balance score + explanation per role

### System 2 — Execution Priority Score

_Replaces the Phase 5 ranking engine. Uses Life Balance Score as input but remains a separate computation._

#### Formula

```
task_value  = role_weight × goal_weight × impact × commitment_multiplier × substantiveness_multiplier
effort_cost = sqrt(max(15, estimated_minutes))
roi         = task_value / effort_cost

role_neglect_multiplier = 1 + 0.8 × max(0, 1 − role_balance_score)

execution_priority_score =
  roi × role_neglect_multiplier × urgency_multiplier × deadline_multiplier
  × commitment_multiplier × context_fit × energy_fit × resistance_bonus
```

#### Multiplier defaults

| Factor                     | Value   |
| -------------------------- | ------- |
| commitment (one_time)      | 1.25    |
| daily                      | 0.9     |
| substantiveness: trivial   | 0.4     |
| substantiveness: normal    | 1.0     |
| substantiveness: strategic | 1.3     |
| completion_quality on_time | 1.0     |
| completion_quality late    | 0.9     |
| completion_quality partial | 0.6     |
| neglect k constant         | 0.8     |
| rolling window             | 14 days |

#### Implementation

- ✅ Update `backend/internal/ranking/domain/scorer.go` — replace old formula with full EPS formula
- ✅ Inject `BalanceService` into ranking service (used only to read balance scores, not to mutate)
- ✅ `GET /api/v1/tasks/ranked` — updated to return `execution_priority_score`, `rank`, `explanations` per task
- ✅ Explanation fields: human-readable strings, e.g. _"High ROI + Finance role neglected"_

### Combined dashboard endpoint

- ✅ `GET /api/v1/dashboard/today` — returns `{ role_balance_summary, recommended_tasks }`

### Extension points (scaffolded now, not implemented)

- ⬜ `maintenance_decay` hook in balance service (interface stub)
- ⬜ `anti_busywork_filter` hook in ranking service (interface stub)
- ⬜ `deferral_penalty` field on tasks (column + zero-value for now)
- ✅ `consistency_bonus` integrated via gamification streak bonus in ranking service
- ⬜ `context_match` and `energy_fit` accept enum input but default to 1.0

### Tests

- ✅ Case 1: 1 completed task + 10 open vs 1 completed + 100 open → different balance ratios
- ✅ Case 2: role with zero recent activity but non-zero `maintenance_floor` → decay signal
- ✅ Case 3: short high-impact task outranks long low-impact task
- ✅ Case 4: urgent task vs neglected-role task comparison
- ✅ Case 5: deadline pressure increases expected contribution
- ✅ Case 6: ranking changes when `role_balance_score` changes

### Frontend

- ✅ Radar chart role balance visualization on web Dashboard (using `recharts` or `d3`)
- ⬜ Mobile Today tab: show role balance mini-bar per role
- ✅ Each ranked task shows its score + explanation tooltip/sheet

### ✅ Testable milestone: Neglect a role for 5 days → balance score drops → tasks in that role rise in ranking

---

## Phase 14 — Today Dashboard v2 + Task Filtering

_Goal: Make the Today view actionable with filters and a cleaner layout._

- ✅ Task filter bar: **All tasks** | **Per role** (dropdown) | **Per tag** (multi-select)
- ✅ Filter persists in URL query params for shareability
- ✅ Separate "scheduled for today" section from "anytime / backlog" section
- ✅ Daily tasks show today's completion dot (done / not-done)
- ✅ Mobile Today screen: same filter controls via bottom sheet
- ✅ DailyBriefCard: collapse / expand state persisted in `localStorage`

### ✅ Testable milestone: Filter Today view by "Engineering" role, see only engineering tasks ranked

---

## Phase 15 — Calendar View

_Goal: Visualize tasks across time — essential for scheduling work and spotting deadline clusters._

- ✅ **Month view**: grid of days; each day shows coloured task dots (by role colour); click day → day detail sheet
- ✅ **Week view**: column per day, time-blocked cards for tasks with `scheduled_date` today; unscheduled tasks in sidebar
- ✅ **Day view**: time-ordered list of scheduled tasks + unscheduled backlog
- ✅ Drag-and-drop to reschedule tasks (web only; mobile uses tap → date picker)
- ✅ Due date indicators (soft deadline = yellow, hard deadline = red)
- ✅ Route: `/calendar` (web), Calendar tab (mobile)
- ✅ Backend: no new endpoints needed — reuses `GET /api/v1/tasks` with date range filters added as query params (`scheduled_from`, `scheduled_to`, `due_from`, `due_to`)
- ✅ Add date range filter query params to `GET /api/v1/tasks`

### ✅ Testable milestone: Drag a task from Monday to Wednesday, verify `scheduled_date` updates

---

## Phase 16 — Wishlist v2 + Currency Enhancements

_Goal: Mark items as bought, order items by heuristic priority, align currencies across the app._

### Wishlist enhancements

- ✅ `backend/migrations/000011_wishlist_v2.up.sql`:
  - Add `bought_at TIMESTAMPTZ` (nullable — set when marked bought)
  - Rename `importance` → `impact` `SMALLINT DEFAULT 3` (1–5, matching task scale)
  - Change `currency` column default to `'MXN'`
- ✅ `POST /api/v1/wishlist/:id/mark-bought` — sets `bought_at = now()`, item hidden from active list
- ✅ `GET  /api/v1/wishlist` — exclude bought items by default; accept `?include_bought=true`

#### Heuristic buy-order ranking

- ✅ `backend/internal/wishlist/domain/ranker.go` — pure function, no I/O:

  ```
  item_roi    = impact / normalized_price   (price normalized to MXN using fixed rate)
  item_score  = item_roi × goal_weight × role_weight
  ```

  - Items without goal/role: use weight = 1.0
  - Price normalization: simple configurable USD→MXN rate (env var `USD_TO_MXN_RATE`, default 17.5)

- ✅ `GET /api/v1/wishlist/ranked` — returns items ordered by `item_score` with `rank` + `explanation`
- ✅ Frontend: Wishlist page shows ranked order with score badge; "Mark as bought" button per item → item slides out of list

### Currency dropdown (app-wide)

- ✅ Frontend: all currency inputs (finance transactions, wishlist items) use a dropdown: **MXN** (default) | **USD**
- ✅ Backend `CreateTransaction` and `CreateItem` accept `currency` as before; frontend ensures it's always populated from the dropdown
- ✅ Finance summary `GET /api/v1/finance/summary`: display totals in MXN; USD balances converted using same rate for display only

### ✅ Testable milestone: Add 5 wishlist items at different prices and impact levels; ranked order reflects ROI; mark cheapest bought → disappears from list

---

## Phase 17 — Gamification

_Goal: Engagement layer without distorting real priorities._

- ✅ `backend/migrations/000012_create_gamification.up.sql` — `user_streaks`, `xp_log`, `achievements`
- ✅ Consistency bonus calculation (feeds into Phase 13 `consistency_bonus` extension point)
- ✅ Streak tracking per role and globally
- ✅ XP awards: task completion, expense logged, wishlist item evaluated
- ✅ Achievement unlock system ("7-day streak", "first investment logged", etc.)
- ✅ `GET /api/v1/gamification/profile`
- ✅ Gamification widgets on Today dashboard + mobile home screen

### ✅ Testable milestone: Complete 3 tasks in a day, see XP and streak update

---

## Phase 18 — Health Domain (Deferred)

_Goal: Log workouts and body metrics; framework for future wearable integrations._

### Database

- ⬜ `backend/migrations/000013_create_health.up.sql`:
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

| Phase | Description                             | Status |
| ----- | --------------------------------------- | ------ |
| 0     | Repo scaffold + external services       | ✅     |
| 1     | Backend foundation (Fiber + DB + auth)  | ✅     |
| 2     | Roles domain                            | ✅     |
| 3     | Goals domain                            | ✅     |
| 4     | Tasks domain                            | ✅     |
| 5     | Ranking engine                          | ✅     |
| 6     | AI task agent + inbox                   | ✅     |
| 7     | Frontend web MVP                        | ✅     |
| 8     | Frontend mobile MVP                     | ✅     |
| 9     | Finance domain                          | ✅     |
| 10    | Wishlist decision engine                | ✅     |
| 11    | Timeline + daily strategy agent         | ✅     |
| 12    | Task Model v2 (impact, effort, types)   | ✅     |
| 13    | Execution Priority + Life Balance Score | ✅     |
| 14    | Today Dashboard v2 + Task Filtering     | ✅     |
| 15    | Calendar View                           | ✅     |
| 16    | Wishlist v2 + Currency Enhancements     | ✅     |
| 17    | Gamification                            | ⬜     |
| 18    | Health domain (deferred)                | ⬜     |
