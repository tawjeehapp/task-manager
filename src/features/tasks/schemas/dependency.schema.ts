import { z } from "zod";

export const addTaskDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid("معرّف المهمة غير صالح"),
});

export const listTaskActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((value) => [25, 50, 100].includes(value), {
      message: "حجم الصفحة غير صالح",
    })
    .default(25),
});

export type AddTaskDependencyInput = z.infer<typeof addTaskDependencySchema>;
export type ListTaskActivityQuery = z.infer<typeof listTaskActivityQuerySchema>;
