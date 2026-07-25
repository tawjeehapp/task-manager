import { z } from "zod";

import {
  taskStatusSchema,
} from "@/features/tasks/schemas/task.schema";

export const ganttQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  assignee: z.string().uuid().optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

export type GanttQuery = z.infer<typeof ganttQuerySchema>;
