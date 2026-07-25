import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");

export const createWorkLogSchema = z.object({
  taskId: z.string().uuid("معرّف المهمة غير صالح"),
  date: dateString,
  hours: z.coerce.number().positive("عدد الساعات يجب أن يكون أكبر من صفر"),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export const updateWorkLogSchema = z
  .object({
    taskId: z.string().uuid().optional(),
    date: dateString.optional(),
    hours: z.coerce.number().positive().optional(),
    description: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
  })
  .refine(
    (data) =>
      data.taskId !== undefined ||
      data.date !== undefined ||
      data.hours !== undefined ||
      data.description !== undefined,
    { message: "لا توجد حقول للتحديث" },
  );

export const listWorkLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(v),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  sortBy: z.enum(["date", "hours", "created_at"]).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  userId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});

export type CreateWorkLogInput = z.infer<typeof createWorkLogSchema>;
export type UpdateWorkLogInput = z.infer<typeof updateWorkLogSchema>;
export type ListWorkLogsQuery = z.infer<typeof listWorkLogsQuerySchema>;
