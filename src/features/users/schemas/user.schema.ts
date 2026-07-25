import { z } from "zod";

import { employeeNumberSchema } from "@/features/auth/schemas/auth.schema";

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

export const createUserSchema = z.object({
  employeeNumber: employeeNumberSchema,
  fullName: z.string().min(2, "الاسم مطلوب"),
  phone: optionalPhoneSchema,
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: optionalPhoneSchema,
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
