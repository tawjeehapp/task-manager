import { describe, expect, it } from "vitest";

import {
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from "@/features/announcements/schemas/announcement.schema";
import {
  listNotificationsQuerySchema,
  notificationTypeSchema,
} from "@/features/notifications/schemas/notification.schema";
import { notificationHref } from "@/features/notifications/lib/notification-href";

describe("announcement schemas", () => {
  it("requires department for department audience", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "عنوان",
      content: "محتوى",
      audienceType: "department",
      priority: "medium",
    });
    expect(result.success).toBe(false);
  });

  it("accepts company audience without department", () => {
    const result = createAnnouncementSchema.safeParse({
      title: "عنوان الشركة",
      content: "محتوى الإعلان",
      audienceType: "company",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("parses list query defaults", () => {
    const query = listAnnouncementsQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(25);
    expect(query.status).toBe("active");
  });
});

describe("notification schemas", () => {
  it("accepts known notification types", () => {
    expect(notificationTypeSchema.parse("task_assigned")).toBe("task_assigned");
    expect(notificationTypeSchema.parse("announcement")).toBe("announcement");
  });

  it("parses unreadOnly flag", () => {
    const query = listNotificationsQuerySchema.parse({ unreadOnly: "true" });
    expect(query.unreadOnly).toBe(true);
  });
});

describe("notificationHref", () => {
  it("maps entity types to routes", () => {
    expect(notificationHref("task", "a1000001-0000-4000-8000-000000000001")).toBe(
      "/tasks/a1000001-0000-4000-8000-000000000001",
    );
    expect(notificationHref("announcement", "x")).toBe("/announcements");
    expect(notificationHref("leave_request", "x")).toBe("/leave");
    expect(notificationHref("attendance_record", "x")).toBe("/attendance");
    expect(notificationHref("employee_request", "x")).toBe("/approvals");
    expect(notificationHref(null, null)).toBeNull();
  });
});
