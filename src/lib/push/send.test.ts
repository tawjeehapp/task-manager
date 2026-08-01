import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@/config/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:test@example.com",
  }),
}));

vi.mock("@/features/notifications/services/push-subscriptions", () => ({
  listPushSubscriptionsForUsers: vi.fn(),
  deletePushSubscriptionByEndpoint: vi.fn(),
}));

describe("sendWebPushToUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends to each subscription and prunes gone endpoints", async () => {
    const webpush = (await import("web-push")).default;
    const {
      listPushSubscriptionsForUsers,
      deletePushSubscriptionByEndpoint,
    } = await import("@/features/notifications/services/push-subscriptions");
    const { sendWebPushToUsers } = await import("@/lib/push/send");

    vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([
      {
        id: "1",
        user_id: "u1",
        endpoint: "https://push.example/alive",
        p256dh: "k1",
        auth: "a1",
        user_agent: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "2",
        user_id: "u1",
        endpoint: "https://push.example/gone",
        p256dh: "k2",
        auth: "a2",
        user_agent: null,
        created_at: "",
        updated_at: "",
      },
    ]);

    vi.mocked(webpush.sendNotification)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce({ statusCode: 410 });

    await sendWebPushToUsers(["u1"], {
      title: "Title",
      message: "Body",
      url: "/tasks/1",
    });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(deletePushSubscriptionByEndpoint).toHaveBeenCalledWith(
      "https://push.example/gone",
    );
    expect(deletePushSubscriptionByEndpoint).toHaveBeenCalledTimes(1);
  });

  it("no-ops when there are no subscriptions", async () => {
    const webpush = (await import("web-push")).default;
    const { listPushSubscriptionsForUsers } = await import(
      "@/features/notifications/services/push-subscriptions"
    );
    const { sendWebPushToUsers } = await import("@/lib/push/send");

    vi.mocked(listPushSubscriptionsForUsers).mockResolvedValue([]);

    await sendWebPushToUsers(["u1"], {
      title: "Title",
      message: "Body",
      url: "/notifications",
    });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
