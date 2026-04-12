export interface Role {
  id: string;
  user_id: string;
  name: string;
  description: string;
  weight: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  role_id: string;
  title: string;
  description: string;
  status: string;
  urgency: number;
  parent_goal_id: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskType = 'one_time' | 'daily';

export interface CompletionEntry {
  date: string;
  done: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  primary_role_id: string;
  goal_id: string | null;
  title: string;
  description: string;
  task_type: TaskType;
  impact: number;
  effort: number;
  estimated_minutes: number | null;
  scheduled_date: string | null;
  soft_deadline: string | null;
  completion_log: CompletionEntry[];
  status: string;
  context_tags: string[];
  secondary_roles: string[];
  deadline: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoredTask {
  task: Task;
  score: number;
}

export interface TaskSuggestion {
  title: string;
  description: string;
  role_id: string;
  goal_id: string | null;
  task_type: TaskType;
  impact: number;
  context_tags: string[];
  deadline_hint: string | null;
}

export interface AISuggestion {
  id: string;
  user_id: string;
  raw_text: string;
  suggestion: TaskSuggestion;
  status: string;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Finance ──────────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'credit_card' | 'other';
export type TransactionType = 'income' | 'expense';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  category: string;
  amount: number;
  percentage: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  role_id: string | null;
  description: string;
  date: string;
  splits: TransactionSplit[] | null;
  created_at: string;
  updated_at: string;
}

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  created_at: string;
}

export interface FinanceSummary {
  total_balance: number;
  month_income: number;
  month_expenses: number;
  by_category: Record<string, number>;
}

// ── Wishlist ─────────────────────────────────────────────────────────────────

export type WishlistVerdict = 'buy_now' | 'wait' | 'reject' | 'replace';

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  price: number;
  currency: string;
  role_id: string | null;
  goal_id: string | null;
  importance: number;
  roi_score: number | null;
  emotional_score: number | null;
  cooldown_days: number;
  verdict: WishlistVerdict | null;
  verdict_reasoning: string | null;
  evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'task_completed'
  | 'expense_logged'
  | 'wishlist_evaluated'
  | 'role_updated'
  | 'goal_updated';

export interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: TimelineEventType;
  domain: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

// ── Daily Brief ───────────────────────────────────────────────────────────────

export interface DailyBriefAction {
  priority: number;
  description: string;
  domain: string;
}

export interface DailyBrief {
  top_actions: DailyBriefAction[];
  finance_alert: string;
  health_nudge: string;
  generated_at: string;
}
