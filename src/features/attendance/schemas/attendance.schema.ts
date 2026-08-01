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

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");

const timeOfDay = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "وقت غير صالح");

const positiveHours = z.coerce
  .number()
  .positive("عدد الساعات يجب أن يكون أكبر من صفر");

export const attendanceAllocationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task"),
    taskId: z.string().uuid("معرّف المهمة غير صالح"),
    hours: positiveHours,
  }),
  z.object({
    type: z.literal("general"),
    reason: z
      .string()
      .trim()
      .min(2, "سبب الدوام العام مطلوب"),
    hours: positiveHours,
  }),
]);

function refineUniqueTaskAllocations(
  data: { allocations: z.infer<typeof attendanceAllocationSchema>[] },
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  for (const [index, row] of data.allocations.entries()) {
    if (row.type !== "task") continue;
    if (seen.has(row.taskId)) {
      ctx.addIssue({
        code: "custom",
        message: "لا يمكن تكرار نفس المهمة الفرعية",
        path: ["allocations", index, "taskId"],
      });
    }
    seen.add(row.taskId);
  }
}

const allocationsField = z
  .array(attendanceAllocationSchema)
  .min(1, "يجب توزيع كامل ساعات الدوام على مهام أو دوام عام");

export const submitAttendanceSchema = z
  .object({
    date: dateString,
    clockIn: timeOfDay,
    clockOut: timeOfDay,
    breakMinutes: z.coerce.number().int().min(0).default(0),
    allocations: allocationsField,
  })
  .superRefine(refineUniqueTaskAllocations);

/** Employee edit of an existing pending/rejected submission (date locked on record). */
export const resubmitAttendanceSchema = z
  .object({
    clockIn: timeOfDay,
    clockOut: timeOfDay,
    breakMinutes: z.coerce.number().int().min(0).default(0),
    allocations: allocationsField,
  })
  .superRefine(refineUniqueTaskAllocations);

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
  /** When true, attach task/general work_log allocations to each row. */
  includeAllocations: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  /** Limit to requesters with this role (e.g. department_manager for admin inbox). */
  requesterRole: z
    .enum(["admin", "department_manager", "employee"])
    .optional(),
});

export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AttendanceAllocationInput = z.infer<
  typeof attendanceAllocationSchema
>;
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;
export type ResubmitAttendanceInput = z.infer<typeof resubmitAttendanceSchema>;
export type RejectAttendanceInput = z.infer<typeof rejectAttendanceSchema>;
