import { z } from "zod";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/table/constants";

export const listEntityActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .refine((value) =>
      (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
    )
    .default(DEFAULT_TABLE_PAGE_SIZE),
});

export type ListEntityActivityQuery = z.infer<
  typeof listEntityActivityQuerySchema
>;
