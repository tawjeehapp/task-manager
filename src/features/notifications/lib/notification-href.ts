import type { NotificationEntityType } from "@/features/notifications/types/notification.types";

/** Client-side deep link from notification entity. */
export function notificationHref(
  entityType: NotificationEntityType | null,
  entityId: string | null,
): string | null {
  if (!entityType || !entityId) {
    return null;
  }

  switch (entityType) {
    case "task":
      return `/tasks/${entityId}`;
    case "leave_request":
      return "/leave";
    case "employee_request":
      return "/approvals";
    case "attendance_record":
      return "/attendance";
    case "announcement":
      return "/announcements";
    default:
      return null;
  }
}
