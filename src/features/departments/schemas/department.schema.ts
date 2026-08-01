import { z } from "zod";

export const departmentStatusSchema = z.enum(["active", "archived"]);

export const createDepartmentSchema = z.object({
  name: z.string().min(2, "اسم القسم مطلوب"),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  managerId: z.string().uuid("يجب اختيار مدير للقسم"),
});

export const updateDepartmentSchema = z
  .object({
    name: z.string().min(2, "اسم القسم مطلوب").optional(),
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
    status: departmentStatusSchema.optional(),
    managerId: z.string().uuid().optional(),
    replaceExistingManager: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.managerId !== undefined,
    { message: "لا توجد بيانات للتحديث" },
  );

export const listDepartmentsQuerySchema = z.object({
  status: departmentStatusSchema.optional(),
  managerId: z
    .union([z.literal("none"), z.string().uuid()])
    .optional(),
  includeArchived: z
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
    .enum(["name", "status", "memberCount", "activeProjectCount", "createdAt"])
    .default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const addDepartmentMemberSchema = z.object({
  userId: z.string().uuid("معرّف المستخدم غير صالح"),
});

export const moveDepartmentMemberSchema = z.object({
  userId: z.string().uuid("معرّف المستخدم غير صالح"),
  toDepartmentId: z.string().uuid("معرّف القسم غير صالح"),
});

export const listMembersQuerySchema = z.object({
  includeHistory: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
export type AddDepartmentMemberInput = z.infer<typeof addDepartmentMemberSchema>;
export type MoveDepartmentMemberInput = z.infer<
  typeof moveDepartmentMemberSchema
>;
export type DepartmentSortBy = ListDepartmentsQuery["sortBy"];
