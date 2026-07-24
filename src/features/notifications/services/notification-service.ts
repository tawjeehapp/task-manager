import type {
  CreateNotificationInput,
  Notification,
} from "@/features/notifications/types/notification.types";

const NOT_IMPLEMENTED =
  "Notification service is not implemented in Milestone 0. Persistence requires authentication and the user model (Milestone 1+).";

/**
 * Placeholder notification service.
 * Methods throw until the real implementation lands after auth.
 */
export const notificationService = {
  async list(): Promise<Notification[]> {
    throw new Error(NOT_IMPLEMENTED);
  },

  async create(input: CreateNotificationInput): Promise<Notification> {
    void input;
    throw new Error(NOT_IMPLEMENTED);
  },

  async markRead(): Promise<Notification> {
    throw new Error(NOT_IMPLEMENTED);
  },
};
