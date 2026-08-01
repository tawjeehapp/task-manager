import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const projectRequestTypeSchema = z.enum(["extension"]);
export const projectRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const createProjectRequestSchema = z.object({
  projectId: z.string().uuid(),
  requestedDate: isoDate,
  reason: z.string().trim().min(1, "السبب مطلوب").max(1000),
});

export const rejectProjectRequestSchema = z.object({
  reason: z.string().trim().min(2, "سبب الرفض مطلوب"),
});

export const listProjectRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(v),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
  sortBy: z.enum(["created_at", "status", "type"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  status: projectRequestStatusSchema.optional(),
  type: projectRequestTypeSchema.optional(),
  projectId: z.string().uuid().optional(),
});

export type CreateProjectRequestInput = z.infer<
  typeof createProjectRequestSchema
>;
export type RejectProjectRequestInput = z.infer<
  typeof rejectProjectRequestSchema
>;
export type ListProjectRequestsQuery = z.infer<
  typeof listProjectRequestsQuerySchema
>;
