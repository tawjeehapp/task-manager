import { z } from "zod";

import {
  ANNOUNCEMENT_AUDIENCE_TYPES,
  ANNOUNCEMENT_PRIORITIES,
} from "@/features/announcements/types/announcement.types";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

export const announcementAudienceSchema = z.enum(ANNOUNCEMENT_AUDIENCE_TYPES);
export const announcementPrioritySchema = z.enum(ANNOUNCEMENT_PRIORITIES);

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(1).max(10000),
    audienceType: announcementAudienceSchema,
    departmentId: z.string().uuid().nullable().optional(),
    priority: announcementPrioritySchema.default("medium"),
    publishAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audienceType === "company" && data.departmentId) {
      ctx.addIssue({
        code: "custom",
        message: "إعلان الشركة لا يرتبط بقسم",
        path: ["departmentId"],
      });
    }
    if (data.audienceType === "department" && !data.departmentId) {
      ctx.addIssue({
        code: "custom",
        message: "يجب تحديد القسم لإعلان القسم",
        path: ["departmentId"],
      });
    }
    if (data.expiresAt && data.publishAt && data.expiresAt <= data.publishAt) {
      ctx.addIssue({
        code: "custom",
        message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ النشر",
        path: ["expiresAt"],
      });
    }
  });

export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    priority: announcementPrioritySchema.optional(),
    publishAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.content !== undefined ||
      data.priority !== undefined ||
      data.publishAt !== undefined ||
      data.expiresAt !== undefined,
    { message: "لا توجد حقول للتحديث" },
  );

export const listAnnouncementsQuerySchema = z.object({
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
  audienceType: announcementAudienceSchema.optional(),
  priority: announcementPrioritySchema.optional(),
  status: z.enum(["active", "expired", "all"]).default("active"),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const markAnnouncementsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListAnnouncementsQuery = z.infer<
  typeof listAnnouncementsQuerySchema
>;
export type MarkAnnouncementsReadInput = z.infer<
  typeof markAnnouncementsReadSchema
>;
