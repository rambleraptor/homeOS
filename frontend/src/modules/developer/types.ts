/**
 * Types for Developer module
 */

export interface Action {
  id: string;
  name: string;
  description: string;
  script_id: string;
  parameters: Record<string, unknown>;
  last_run_at?: string;
  created_by: string;
  created: string;
  updated: string;
}

export type ActionRunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'success'
  | 'error';

export interface ActionRun {
  id: string;
  action: string; // Action ID
  status: ActionRunStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  logs?: LogEntry[];
  error?: string;
  result?: Record<string, unknown>;
  input_request?: InputRequest;
  input_response?: Record<string, unknown>;
  created: string;
  updated: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface InputRequest {
  prompt: string;
  field_name: string;
  field_type: 'text' | 'password' | 'number';
  placeholder?: string;
}

export interface ActionFormData {
  name: string;
  description: string;
  script_id: string;
  parameters: Record<string, unknown>;
}
