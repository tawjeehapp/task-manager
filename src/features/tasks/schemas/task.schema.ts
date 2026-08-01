import { z } from "zod";

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "blocked",
  "completed",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const createTaskSchema = z.object({
  projectId: z.string().uuid("معرّف المشروع غير صالح"),
  title: z.string().min(2, "عنوان المهمة مطلوب"),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  status: taskStatusSchema.optional().default("todo"),
  priority: taskPrioritySchema.optional().default("medium"),
  assignedTo: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimatedHours: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z
      .coerce.number({
        error: (iss) =>
          iss.input === undefined
            ? "الساعات المقدرة مطلوبة"
            : "الساعات المقدرة غير صالحة",
      })
      .positive("الساعات المقدرة يجب أن تكون أكبر من صفر"),
  ),
  dependsOnTaskIds: z
    .array(z.string().uuid("معرّف المهمة غير صالح"))
    .optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(2, "عنوان المهمة مطلوب").optional(),
    description: z
      .string()
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === "" ? null : value;
      }),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assignedTo: z
      .union([z.string().uuid(), z.literal(""), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === "" ? null : value;
      }),
    startDate: z
      .string()
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === "" ? null : value;
      }),
    dueDate: z
      .string()
      .nullable()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        return value === "" ? null : value;
      }),
    estimatedHours: z.coerce
      .number({
        error: () => "الساعات المقدرة غير صالحة",
      })
      .positive("الساعات المقدرة يجب أن تكون أكبر من صفر")
      .optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.assignedTo !== undefined ||
      data.startDate !== undefined ||
      data.dueDate !== undefined ||
      data.estimatedHours !== undefined,
    { message: "لا توجد بيانات للتحديث" },
  );

export const listTasksQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: taskStatusSchema.optional(),
  assignee: z.string().uuid().optional(),
  priority: taskPrioritySchema.optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((value) => [25, 50, 100].includes(value), {
      message: "حجم الصفحة غير صالح",
    })
    .default(25),
  sortBy: z
    .enum([
      "title",
      "status",
      "priority",
      "dueDate",
      "startDate",
      "createdAt",
    ])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskSortBy = ListTasksQuery["sortBy"];
