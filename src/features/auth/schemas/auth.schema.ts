import { z } from "zod";

export const employeeNumberSchema = z
  .string()
  .regex(/^\d{4}$/, "رقم الموظف يجب أن يكون 4 أرقام");

export const loginSchema = z.object({
  employeeNumber: employeeNumberSchema,
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().min(4, "كلمة المرور الجديدة قصيرة جداً"),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "يجب اختيار كلمة مرور مختلفة",
    path: ["newPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
