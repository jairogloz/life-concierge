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

export type CommitmentType = 'commitment' | 'habit' | 'recurring' | 'intention';

export interface Task {
  id: string;
  user_id: string;
  primary_role_id: string;
  goal_id: string | null;
  title: string;
  description: string;
  commitment_type: CommitmentType;
  urgency: number;
  status: string;
  context_tags: string[];
  secondary_roles: string[];
  deadline: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
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
  commitment_type: CommitmentType;
  urgency: number;
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
