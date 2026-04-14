package domain

import (
	"errors"
	"time"
)

var (
	ErrWeekNotFound      = errors.New("week not found")
	ErrInvalidTransition = errors.New("invalid week status transition")
)

type WeekStatus string

const (
	WeekStatusPlanning WeekStatus = "planning"
	WeekStatusActive   WeekStatus = "active"
	WeekStatusReview   WeekStatus = "review"
	WeekStatusClosed   WeekStatus = "closed"
)

type AllocationLane string

const (
	AllocationLaneDailyPriority AllocationLane = "daily_priority"
	AllocationLaneTimeslot      AllocationLane = "timeslot"
)

type ReviewAction string

const (
	ReviewActionDone     ReviewAction = "done"
	ReviewActionBacklog  ReviewAction = "backlog"
	ReviewActionMoveNext ReviewAction = "move_next_week"
)

type Week struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	StartsOn  time.Time  `json:"starts_on"`
	EndsOn    time.Time  `json:"ends_on"`
	Status    WeekStatus `json:"status"`
	StartedAt *time.Time `json:"started_at,omitempty"`
	ClosedAt  *time.Time `json:"closed_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type WeekPriority struct {
	ID         string    `json:"id"`
	WeekID     string    `json:"week_id"`
	Text       string    `json:"text"`
	OrderIndex int       `json:"order_index"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type TaskAllocation struct {
	ID               string         `json:"id"`
	WeekID           string         `json:"week_id"`
	TaskID           string         `json:"task_id"`
	DayOfWeek        int            `json:"day_of_week"`
	SlotMinuteOfDay  *int           `json:"slot_minute_of_day,omitempty"`
	Lane             AllocationLane `json:"lane"`
	StatusSnapshot   string         `json:"status_snapshot"`
	TaskTitle        string         `json:"task_title"`
	TaskStatus       string         `json:"task_status"`
	RoleID           string         `json:"role_id"`
	RoleName         string         `json:"role_name"`
	RoleColor        string         `json:"role_color"`
	EstimatedMinutes *int           `json:"estimated_minutes,omitempty"`
	Impact           int            `json:"impact"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

type BalancePoint struct {
	RoleID   string  `json:"role_id"`
	RoleName string  `json:"role_name"`
	Color    string  `json:"color"`
	Value    float64 `json:"value"`
}

type WeekBalanceSnapshot struct {
	Current []BalancePoint `json:"current"`
	Target  []BalancePoint `json:"target"`
}
