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
    reason: z.string().trim().min(1, "السبب مطلوب").max(1000),
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

export const updateEmployeeRequestSchema = z
  .object({
    reason: z.string().trim().min(1, "السبب مطلوب").max(1000).optional(),
    requestedDate: isoDate.optional().nullable(),
  })
  .refine(
    (data) => data.reason !== undefined || data.requestedDate !== undefined,
    { message: "لا توجد بيانات للتحديث" },
  );

export const rejectEmployeeRequestSchema = z.object({
  reason: z.string().trim().min(2, "سبب الرفض مطلوب"),
});

export const approveEmployeeRequestSchema = z.object({
  /** Required when approving an excusal; ignored for extensions. */
  assignedTo: z.string().uuid().optional(),
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
export type UpdateEmployeeRequestInput = z.infer<
  typeof updateEmployeeRequestSchema
>;
export type RejectEmployeeRequestInput = z.infer<
  typeof rejectEmployeeRequestSchema
>;
export type ApproveEmployeeRequestInput = z.infer<
  typeof approveEmployeeRequestSchema
>;
export type ListEmployeeRequestsQuery = z.infer<
  typeof listEmployeeRequestsQuerySchema
>;
