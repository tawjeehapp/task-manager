import { z } from "zod";

import { employeeNumberSchema } from "@/features/auth/schemas/auth.schema";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

export const userRoleSchema = z.enum([
  "admin",
  "department_manager",
  "employee",
]);

/** Libyan-style mobile: 09 followed by 8 digits (10 total). */
export const phoneNumberSchema = z
  .string()
  .regex(/^09\d{8}$/, "رقم الهاتف يجب أن يبدأ بـ 09 ويتبعه 8 أرقام");

const optionalPhoneSchema = z
  .union([phoneNumberSchema, z.literal("")])
  .optional()
  .nullable()
  .transform((value) => (value === "" || value === undefined ? null : value));

/** Weekly capacity in hours (Sun–Thu week). Default 40. */
export const weeklyCapacityHoursSchema = z.coerce
  .number()
  .finite()
  .gt(0, "ساعات السعة الأسبوعية يجب أن تكون أكبر من صفر")
  .lte(80, "ساعات السعة الأسبوعية يجب ألا تتجاوز 80");

export const createUserSchema = z.object({
  employeeNumber: employeeNumberSchema,
  fullName: z.string().min(2, "الاسم مطلوب"),
  phone: optionalPhoneSchema,
  role: userRoleSchema,
  weeklyCapacityHours: weeklyCapacityHoursSchema.default(40),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z
    .union([phoneNumberSchema, z.literal(""), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === "" ? null : value;
    }),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  weeklyCapacityHours: weeklyCapacityHoursSchema.optional(),
});

export const userSortBySchema = z.enum([
  "fullName",
  "employeeNumber",
  "role",
  "status",
  "createdAt",
]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine(
      (value): value is (typeof TABLE_PAGE_SIZE_OPTIONS)[number] =>
        (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
      { message: "حجم الصفحة غير صالح" },
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  /** UUID of department, or `none` for users without a current department. */
  departmentId: z.union([z.string().uuid(), z.literal("none")]).optional(),
  sortBy: userSortBySchema.default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = {
  fullName?: string;
  phone?: string | null;
  role?: z.infer<typeof userRoleSchema>;
  isActive?: boolean;
  weeklyCapacityHours?: number;
};
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserSortBy = z.infer<typeof userSortBySchema>;
