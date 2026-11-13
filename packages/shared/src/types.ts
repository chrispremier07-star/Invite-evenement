import type { Answers } from './schemas';
import type { StatusId } from './statuses';

export interface PublicConfig {
  responseDelayHours: number;
  turnstileSiteKey: string;
  turnstileScriptUrl: string;
  privacy: { controller: string; contactEmail: string; retentionDays: number; policyVersion: string };
}

export interface SubmissionSummary {
  id: string;
  receivedAt: string;
  status: StatusId;
  read: boolean;
  name: string;
  type: string;
  eventDate: string | null;
  guests: number | null;
  firstPlace: string | null;
}

export interface AttachmentInfo {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface NoteInfo {
  id: string;
  body: string;
  createdAt: string;
}

export interface SubmissionDetail extends SubmissionSummary {
  answers: Answers;
  timeZone: string | null;
  attachments: AttachmentInfo[];
  notes: NoteInfo[];
}

export interface ListResponse {
  items: SubmissionSummary[];
  nextCursor: string | null;
  counts: Record<StatusId | 'active' | 'all', number>;
  unread: number;
}

export interface DistributionItem {
  label: string;
  count: number;
}
export interface Stats {
  unread: number;
  receivedThisWeek: number;
  total: number;
  active: number;
  signed: number;
  decided: number;
  signatureRate: number | null;
  avgReadHours: number | null;
  pipeline: Record<StatusId, number>;
  byType: DistributionItem[];
  byBudget: DistributionItem[];
  upcoming: Array<{
    id: string;
    name: string;
    type: string;
    eventDate: string;
    daysLeft: number;
    firstPlace: string | null;
    status: StatusId;
  }>;
  nextEvent: { name: string; type: string; daysLeft: number } | null;
}

export interface StudioSettings {
  responseDelayHours: number;
  alertEmail: string;
  retentionDays: number;
  notifyByEmail: boolean;
}

export interface DeviceInfo {
  id: string;
  label: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export type RealtimeEvent =
  | { type: 'submission.created'; id: string; name: string; unread: number }
  | { type: 'submission.updated'; id: string; unread: number }
  | { type: 'submission.deleted'; id: string; unread: number };

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}
