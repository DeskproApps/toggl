export interface ICreateTimeEntry {
  billable?: boolean;
  description?: string;
  stop?: string;
  project_id?: string;
  start?: string;
  tag_ids?: string[];
  duration?: number;
}

export interface ITimeEntry {
  id: string;
  duration: number;
  start: string;
  stop: string;
  tag_ids: string[];
  project_id: string;
  description: string;
  billable: boolean;
}
