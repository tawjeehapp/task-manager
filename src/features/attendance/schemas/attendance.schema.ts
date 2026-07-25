import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

export const attendanceStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const clockOutSchema = z.object({
  breakMinutes: z.coerce.number().int().min(0).optional().default(0),
});

export const rejectAttendanceSchema = z.object({
  reason: z.string().trim().min(2, "سبب الرفض مطلوب"),
});

const isoDateTime = z.string().datetime({ offset: true });

export const updateAttendanceSchema = z
  .object({
    clockIn: isoDateTime.optional(),
    clockOut: isoDateTime.nullable().optional(),
    breakMinutes: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.clockIn !== undefined ||
      data.clockOut !== undefined ||
      data.breakMinutes !== undefined,
    { message: "لا توجد حقول للتحديث" },
  );

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(v),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  sortBy: z
    .enum(["date", "clock_in", "total_hours", "status", "created_at"])
    .default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: attendanceStatusSchema.optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** When true, only pending records that have clock_out set. */
  awaitingApproval: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type RejectAttendanceInput = z.infer<typeof rejectAttendanceSchema>;
