import { describe, expect, it } from "vitest";

import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "@/features/notifications/schemas/push.schema";
import { urlBase64ToUint8Array } from "@/lib/push/subscribe";

describe("push schemas", () => {
  it("accepts a valid subscribe payload", () => {
    const parsed = pushSubscribeSchema.parse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: "p256dh-key",
      auth: "auth-key",
      userAgent: "Mozilla/5.0",
    });
    expect(parsed.endpoint).toContain("https://");
    expect(parsed.p256dh).toBe("p256dh-key");
  });

  it("rejects missing keys", () => {
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: "https://example.com/push",
      }).success,
    ).toBe(false);
  });

  it("accepts optional endpoint on unsubscribe", () => {
    expect(pushUnsubscribeSchema.parse({}).endpoint).toBeUndefined();
    expect(
      pushUnsubscribeSchema.parse({
        endpoint: "https://example.com/push",
      }).endpoint,
    ).toBe("https://example.com/push");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    const bytes = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });
});
