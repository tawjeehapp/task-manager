import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const employeeRequestTypeSchema = z.enum(["extension", "excusal"]);
export const employeeRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const createEmployeeRequestSchema = z
  .object({
    taskId: z.string().uuid(),
    type: employeeRequestTypeSchema,
    reason: z.string().trim().max(1000).optional().nullable(),
    requestedDate: isoDate.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "extension") {
      if (!data.requestedDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تاريخ التمديد مطلوب",
          path: ["requestedDate"],
        });
      }
    } else if (data.requestedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "طلب الإعفاء لا يتضمن تاريخاً",
        path: ["requestedDate"],
      });
    }
  });

export const rejectEmployeeRequestSchema = z.object({
  reason: z.string().trim().min(2, "سبب الرفض مطلوب"),
});

export const listEmployeeRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(v),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  sortBy: z.enum(["created_at", "status", "type"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: employeeRequestStatusSchema.optional(),
  type: employeeRequestTypeSchema.optional(),
  userId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

export type CreateEmployeeRequestInput = z.infer<
  typeof createEmployeeRequestSchema
>;
export type RejectEmployeeRequestInput = z.infer<
  typeof rejectEmployeeRequestSchema
>;
export type ListEmployeeRequestsQuery = z.infer<
  typeof listEmployeeRequestsQuerySchema
>;
