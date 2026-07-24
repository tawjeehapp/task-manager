import { z } from "zod";

import { NOTIFICATION_TYPES } from "@/features/notifications/types/notification.types";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
});

export type NotificationSchema = z.infer<typeof notificationSchema>;
export type CreateNotificationSchema = z.infer<typeof createNotificationSchema>;
