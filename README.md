# Life Concierge — Personal Operating System

> An AI-powered life management platform that allocates your resources (time, money, energy, attention) across roles, goals, and actions and tells you **what to do next**.

## Overview

Most software **tracks** behavior. This platform **decides**.

| Capability | Description                      |
| ---------- | -------------------------------- |
| Primary    | Rank what you should do next     |
| Secondary  | Advise what you should buy next  |
| Tertiary   | Advise how you should train next |

## Tech Stack

| Layer           | Technology                              |
| --------------- | --------------------------------------- |
| Backend         | Go + Fiber (hexagonal modular monolith) |
| Database        | PostgreSQL (Railway)                    |
| Auth            | Clerk                                   |
| Frontend Web    | React + Vite                            |
| Frontend Mobile | Expo (managed)                          |
| AI              | OpenAI GPT-4o                           |
| Migrations      | golang-migrate                          |

## Monorepo Structure

```
life-concierge/
├── backend/            # Go API server
├── frontend-web/       # React + Vite web app
├── frontend-mobile/    # Expo React Native app
├── shared-types/       # Shared TypeScript types
├── infra/              # Docker Compose + infra configs
└── docs/               # Architecture & development docs
```

## Quick Start (Local Development)

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker & Docker Compose
- [Clerk account](https://clerk.com)
- [OpenAI API key](https://platform.openai.com)

### 1. Start local database

```bash
docker-compose -f infra/docker-compose.yml up -d
```

### 2. Configure backend

```bash
cp backend/.env.example backend/.env
# Fill in your Clerk and OpenAI keys in backend/.env
```

### 3. Run migrations

```bash
make -C backend migrate-up
```

### 4. Start backend

```bash
make -C backend run
```

### 5. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"connected"}
```

## Development Plan

See [docs/development_plan.md](docs/development_plan.md) for the full phased implementation plan.

## Domain Architecture

```
Roles → Goals → Tasks → Ranking Engine → Daily Priority List
                             ↑
           Finance ──────────┤
           Health  ──────────┤
           Timeline ─────────┘
```

Each domain follows hexagonal (ports & adapters) architecture:

```
domain/       Entity structs + business rules
ports/        Input (service interfaces) + Output (repository interfaces)
application/  Use-case implementations
adapters/
  http/       Fiber HTTP handlers
  postgres/   pgx repository implementations
  ai/         AI agent adapters (where applicable)
```
