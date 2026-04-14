package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/jairogloz/life-concierge/internal/weeks/domain"
	"github.com/jairogloz/life-concierge/internal/weeks/ports"
)

type Service struct {
	repo ports.WeeksRepository
}

func NewWeeksService(repo ports.WeeksRepository) *Service {
	return &Service{repo: repo}
}

func mondayOf(t time.Time) time.Time {
	u := t.UTC()
	y, m, d := u.Date()
	date := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	iso := int(date.Weekday())
	if iso == 0 {
		iso = 7
	}
	return date.AddDate(0, 0, -(iso - 1))
}

func (s *Service) ListWeeks(ctx context.Context, userID, status string) ([]*domain.Week, error) {
	if userID == "" {
		return nil, fmt.Errorf("validation: user_id is required")
	}
	return s.repo.ListWeeks(ctx, userID, status)
}

func (s *Service) CreateWeek(ctx context.Context, params ports.CreateWeekParams) (*domain.Week, error) {
	if params.UserID == "" {
		return nil, fmt.Errorf("validation: user_id is required")
	}
	start := mondayOf(time.Now())
	if params.StartsOn != nil {
		start = mondayOf(*params.StartsOn)
	}
	week := &domain.Week{
		ID:       uuid.New().String(),
		UserID:   params.UserID,
		StartsOn: start,
		EndsOn:   start.AddDate(0, 0, 6),
		Status:   domain.WeekStatusPlanning,
	}
	if err := s.repo.InsertWeek(ctx, week); err != nil {
		return nil, err
	}
	return s.repo.GetWeek(ctx, params.UserID, week.ID)
}

func (s *Service) GetWeek(ctx context.Context, userID, weekID string) (*domain.Week, error) {
	if userID == "" || weekID == "" {
		return nil, fmt.Errorf("validation: user_id and week_id are required")
	}
	return s.repo.GetWeek(ctx, userID, weekID)
}

func (s *Service) StartWeek(ctx context.Context, userID, weekID string) (*domain.Week, error) {
	return s.repo.UpdateWeekStatus(ctx, userID, weekID, []domain.WeekStatus{domain.WeekStatusPlanning}, domain.WeekStatusActive, time.Now().UTC())
}

func (s *Service) EnterReview(ctx context.Context, userID, weekID string) (*domain.Week, error) {
	return s.repo.UpdateWeekStatus(ctx, userID, weekID, []domain.WeekStatus{domain.WeekStatusActive}, domain.WeekStatusReview, time.Now().UTC())
}

func (s *Service) ReopenWeek(ctx context.Context, userID, weekID string) (*domain.Week, error) {
	return s.repo.UpdateWeekStatus(ctx, userID, weekID, []domain.WeekStatus{domain.WeekStatusClosed}, domain.WeekStatusActive, time.Now().UTC())
}

func (s *Service) CloseWeek(ctx context.Context, userID, weekID string) (*domain.Week, *domain.Week, error) {
	return s.repo.CloseWeekAndCreateNextPlanning(ctx, userID, weekID, time.Now().UTC())
}

func (s *Service) ListPriorities(ctx context.Context, userID, weekID string) ([]*domain.WeekPriority, error) {
	if userID == "" || weekID == "" {
		return nil, fmt.Errorf("validation: user_id and week_id are required")
	}
	return s.repo.ListPriorities(ctx, userID, weekID)
}

func (s *Service) AddPriority(ctx context.Context, userID, weekID, text string, orderIndex int) (*domain.WeekPriority, error) {
	if userID == "" || weekID == "" {
		return nil, fmt.Errorf("validation: user_id and week_id are required")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("validation: priority text is required")
	}
	item := &domain.WeekPriority{ID: uuid.New().String(), WeekID: weekID, Text: text, OrderIndex: orderIndex}
	if err := s.repo.InsertPriority(ctx, item); err != nil {
		return nil, err
	}
	items, err := s.repo.ListPriorities(ctx, userID, weekID)
	if err != nil {
		return nil, err
	}
	for _, v := range items {
		if v.ID == item.ID {
			return v, nil
		}
	}
	return item, nil
}

func (s *Service) DeletePriority(ctx context.Context, userID, weekID, priorityID string) error {
	if userID == "" || weekID == "" || priorityID == "" {
		return fmt.Errorf("validation: user_id, week_id and priority_id are required")
	}
	return s.repo.DeletePriority(ctx, userID, weekID, priorityID)
}

func (s *Service) ListAllocations(ctx context.Context, userID, weekID string) ([]*domain.TaskAllocation, error) {
	if userID == "" || weekID == "" {
		return nil, fmt.Errorf("validation: user_id and week_id are required")
	}
	return s.repo.ListAllocations(ctx, userID, weekID)
}

func (s *Service) UpsertAllocation(ctx context.Context, params ports.UpsertAllocationParams) (*domain.TaskAllocation, error) {
	if params.UserID == "" || params.WeekID == "" || params.TaskID == "" {
		return nil, fmt.Errorf("validation: user_id, week_id and task_id are required")
	}
	if params.DayOfWeek < 1 || params.DayOfWeek > 7 {
		return nil, fmt.Errorf("validation: day_of_week must be between 1 and 7")
	}
	if params.Lane != domain.AllocationLaneDailyPriority && params.Lane != domain.AllocationLaneTimeslot {
		return nil, fmt.Errorf("validation: lane must be daily_priority or timeslot")
	}
	if params.Lane == domain.AllocationLaneTimeslot && params.SlotMinuteOfDay == nil {
		return nil, fmt.Errorf("validation: slot_minute_of_day is required for timeslot lane")
	}
	if params.SlotMinuteOfDay != nil && (*params.SlotMinuteOfDay < 0 || *params.SlotMinuteOfDay >= 1440 || *params.SlotMinuteOfDay%15 != 0) {
		return nil, fmt.Errorf("validation: slot_minute_of_day must be 0..1439 in 15-minute increments")
	}
	item := &domain.TaskAllocation{
		ID:              uuid.New().String(),
		WeekID:          params.WeekID,
		TaskID:          params.TaskID,
		DayOfWeek:       params.DayOfWeek,
		Lane:            params.Lane,
		SlotMinuteOfDay: params.SlotMinuteOfDay,
		StatusSnapshot:  "planned",
	}
	if err := s.repo.UpsertAllocation(ctx, item); err != nil {
		return nil, err
	}
	items, err := s.repo.ListAllocations(ctx, params.UserID, params.WeekID)
	if err != nil {
		return nil, err
	}
	for _, v := range items {
		if v.TaskID == params.TaskID {
			return v, nil
		}
	}
	return item, nil
}

func (s *Service) DeleteAllocation(ctx context.Context, userID, weekID, allocationID string) error {
	if userID == "" || weekID == "" || allocationID == "" {
		return fmt.Errorf("validation: user_id, week_id and allocation_id are required")
	}
	return s.repo.DeleteAllocation(ctx, userID, weekID, allocationID)
}

func (s *Service) ApplyReviewAction(ctx context.Context, params ports.ReviewActionParams) error {
	if params.UserID == "" || params.WeekID == "" {
		return fmt.Errorf("validation: user_id and week_id are required")
	}
	if len(params.TaskIDs) == 0 {
		return fmt.Errorf("validation: task_ids cannot be empty")
	}
	if params.Action != domain.ReviewActionDone && params.Action != domain.ReviewActionBacklog && params.Action != domain.ReviewActionMoveNext {
		return fmt.Errorf("validation: invalid review action")
	}
	return s.repo.ApplyReviewAction(ctx, params.Action, params.UserID, params.WeekID, params.TaskIDs, time.Now().UTC(), params.ToWeekID)
}

func (s *Service) GetBalanceSnapshot(ctx context.Context, userID, weekID string) (*domain.WeekBalanceSnapshot, error) {
	if userID == "" || weekID == "" {
		return nil, fmt.Errorf("validation: user_id and week_id are required")
	}
	return s.repo.GetBalanceSnapshot(ctx, userID, weekID)
}

var _ ports.WeeksService = (*Service)(nil)
