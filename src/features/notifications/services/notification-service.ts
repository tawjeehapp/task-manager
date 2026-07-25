import "server-only";

/**
 * Re-export real notification service.
 * Milestone 0 stub replaced in Milestone 7.
 */
export {
  createNotification,
  createNotificationsForUsers,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationService,
  notifySafe,
} from "@/features/notifications/services/notifications";
