export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_completed",
  "approval_request",
  "approval_result",
  "announcement",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_ENTITY_TYPES = [
  "task",
  "leave_request",
  "employee_request",
  "attendance_record",
  "announcement",
] as const;

export type NotificationEntityType =
  (typeof NOTIFICATION_ENTITY_TYPES)[number];

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
};
