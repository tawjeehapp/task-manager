import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const attachmentFileMetaSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "اسم الملف مطلوب")
    .max(255, "اسم الملف طويل جداً"),
  contentType: z.string().trim().max(200).optional().nullable(),
  byteSize: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_ATTACHMENT_BYTES, "حجم الملف يتجاوز الحد المسموح"),
});

export type AttachmentFileMeta = z.infer<typeof attachmentFileMetaSchema>;
