import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "محتوى التعليق مطلوب")
    .max(5000, "التعليق طويل جداً"),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "محتوى التعليق مطلوب")
    .max(5000, "التعليق طويل جداً"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
