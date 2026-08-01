import { z } from "zod";

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(512).optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().min(1).optional(),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
