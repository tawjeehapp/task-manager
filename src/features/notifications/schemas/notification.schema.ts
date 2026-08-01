import { z } from "zod";

import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
} from "@/features/notifications/types/notification.types";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const notificationEntityTypeSchema = z.enum(NOTIFICATION_ENTITY_TYPES);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  entityType: notificationEntityTypeSchema.nullable(),
  entityId: z.string().uuid().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  entityType: notificationEntityTypeSchema.nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof TABLE_PAGE_SIZE_OPTIONS)[number] =>
        (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
      { message: "حجم الصفحة غير صالح" },
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type NotificationSchema = z.infer<typeof notificationSchema>;
export type CreateNotificationSchema = z.infer<typeof createNotificationSchema>;
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;
export type MarkNotificationsReadInput = z.infer<
  typeof markNotificationsReadSchema
>;
