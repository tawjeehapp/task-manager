import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");

const pageSizeSchema = z.coerce
  .number()
  .int()
  .refine(
    (value): value is (typeof TABLE_PAGE_SIZE_OPTIONS)[number] =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
    { message: "حجم الصفحة غير صالح" },
  )
  .default(DEFAULT_TABLE_PAGE_SIZE);

const baseReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: pageSizeSchema,
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  departmentId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const taskCompletionQuerySchema = baseReportQuerySchema.extend({
  sortBy: z
    .enum([
      "fullName",
      "completedCount",
      "totalCount",
      "completionRate",
    ])
    .default("completionRate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
});

export const employeeWorkloadQuerySchema = baseReportQuerySchema
  .omit({ dateFrom: true, dateTo: true })
  .extend({
    sortBy: z
      .enum(["fullName", "activeTaskCount", "estimatedHours"])
      .default("estimatedHours"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  });

export const attendanceSummaryQuerySchema = baseReportQuerySchema.extend({
  sortBy: z
    .enum(["fullName", "totalHours", "days", "approvedDays"])
    .default("totalHours"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const workLogSummaryQuerySchema = baseReportQuerySchema.extend({
  sortBy: z
    .enum(["fullName", "loggedHours", "logEntries"])
    .default("loggedHours"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

export type TaskCompletionQuery = z.infer<typeof taskCompletionQuerySchema>;
export type EmployeeWorkloadQuery = z.infer<typeof employeeWorkloadQuerySchema>;
export type AttendanceSummaryQuery = z.infer<
  typeof attendanceSummaryQuerySchema
>;
export type WorkLogSummaryQuery = z.infer<typeof workLogSummaryQuerySchema>;
