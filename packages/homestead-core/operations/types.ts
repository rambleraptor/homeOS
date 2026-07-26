export type OperationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/** An AEP-151 long-running operation, normalized for the UI. */
export interface Operation {
  id: string;
  path: string;
  done: boolean;
  status?: OperationStatus;
  method?: string;
  title?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: Record<string, unknown>;
  created: string;
  updated: string;
}
