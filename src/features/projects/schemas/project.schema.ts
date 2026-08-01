import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

export const projectPrioritySchema = z.enum(["low", "medium", "high"]);

const requiredDateSchema = z
  .string({ error: () => "تاريخ انتهاء المشروع مطلوب" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ انتهاء المشروع غير صالح");

const optionalNullableDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));

export const createProjectSchema = z
  .object({
    departmentId: z.string().uuid("معرّف القسم غير صالح"),
    name: z.string().min(2, "اسم المشروع مطلوب"),
    description: z
      .string()
      .optional()
      .nullable()
      .transform((value) =>
        value === "" || value === undefined ? null : value,
      ),
    status: projectStatusSchema.optional().default("draft"),
    priority: projectPrioritySchema.optional().default("medium"),
    startDate: optionalNullableDate,
    endDate: requiredDateSchema,
    memberIds: z.array(z.string().uuid()).optional().default([]),
  })
  .refine(
    (data) =>
      data.startDate == null ||
      data.endDate >= data.startDate,
    {
      message: "تاريخ الانتهاء يجب أن يكون بعد أو يساوي تاريخ البداية",
      path: ["endDate"],
    },
  );

export const updateProjectSchema = z
  .object({
    name: z.string().min(2, "اسم المشروع مطلوب").optional(),
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
    status: projectStatusSchema.optional(),
    priority: projectPrioritySchema.optional(),
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
    endDate: requiredDateSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.priority !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined,
    { message: "لا توجد بيانات للتحديث" },
  )
  .refine(
    (data) => {
      if (data.startDate == null || data.endDate === undefined) {
        return true;
      }
      return data.endDate >= data.startDate;
    },
    {
      message: "تاريخ الانتهاء يجب أن يكون بعد أو يساوي تاريخ البداية",
      path: ["endDate"],
    },
  );

export const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  departmentId: z.string().uuid().optional(),
  memberUserId: z.string().uuid().optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  includeStats: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((value) => [25, 50, 100].includes(value), {
      message: "حجم الصفحة غير صالح",
    })
    .default(25),
  sortBy: z
    .enum(["name", "status", "priority", "startDate", "endDate", "createdAt"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid("معرّف المستخدم غير صالح"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type ProjectSortBy = ListProjectsQuery["sortBy"];
