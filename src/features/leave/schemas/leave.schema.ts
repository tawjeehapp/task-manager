import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const leaveRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateLeaveTypeSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.isActive !== undefined,
    { message: "لا توجد حقول للتحديث" },
  );

export const upsertLeaveBalanceSchema = z.object({
  userId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  allocatedDays: z.coerce.number().int().min(0),
});

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    startDate: isoDate,
    endDate: isoDate,
    reason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية",
    path: ["endDate"],
  });

export const rejectLeaveRequestSchema = z.object({
  reason: z.string().trim().min(2, "سبب الرفض مطلوب"),
});

export const listLeaveRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(v),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  sortBy: z
    .enum(["start_date", "created_at", "status", "days"])
    .default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: leaveRequestStatusSchema.optional(),
  userId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
});

export const listLeaveBalancesQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  leaveTypeId: z.string().uuid().optional(),
});

export const listLeaveTypesQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
export type UpsertLeaveBalanceInput = z.infer<typeof upsertLeaveBalanceSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;
export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
export type ListLeaveBalancesQuery = z.infer<typeof listLeaveBalancesQuerySchema>;
export type ListLeaveTypesQuery = z.infer<typeof listLeaveTypesQuerySchema>;
