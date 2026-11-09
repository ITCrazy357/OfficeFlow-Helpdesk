export const DASHBOARD_CACHE_INVALIDATE_EVENT = 'dashboard.cache.invalidate';

export type DashboardCacheInvalidationReason =
  | 'TICKET_CREATED'
  | 'TICKET_REPORT_FIELDS_UPDATED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_DELETED'
  | 'TICKET_OVERDUE'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED'
  | 'USER_DEPARTMENT_CHANGED';

export class DashboardCacheInvalidatedEvent {
  constructor(
    public readonly reason: DashboardCacheInvalidationReason,
    public readonly entityId: number,
  ) {}
}
