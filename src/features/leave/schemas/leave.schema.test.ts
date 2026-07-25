import { describe, expect, it } from "vitest";

import {
  createLeaveRequestSchema,
  createLeaveTypeSchema,
} from "@/features/leave/schemas/leave.schema";
import {
  createEmployeeRequestSchema,
} from "@/features/employee-requests/schemas/employee-request.schema";

describe("createLeaveRequestSchema", () => {
  it("accepts valid same-order dates", () => {
    const result = createLeaveRequestSchema.safeParse({
      leaveTypeId: "11111111-1111-4111-8111-111111111111",
      startDate: "2026-07-20",
      endDate: "2026-07-22",
      reason: "test",
    });
    expect(result.success).toBe(true);
  });

  it("rejects inverted dates", () => {
    const result = createLeaveRequestSchema.safeParse({
      leaveTypeId: "11111111-1111-4111-8111-111111111111",
      startDate: "2026-07-22",
      endDate: "2026-07-20",
    });
    expect(result.success).toBe(false);
  });
});

describe("createLeaveTypeSchema", () => {
  it("requires name", () => {
    expect(createLeaveTypeSchema.safeParse({ name: "أ" }).success).toBe(false);
    expect(createLeaveTypeSchema.safeParse({ name: "سنوية" }).success).toBe(
      true,
    );
  });
});

describe("createEmployeeRequestSchema", () => {
  it("requires requestedDate for extension", () => {
    const result = createEmployeeRequestSchema.safeParse({
      taskId: "11111111-1111-4111-8111-111111111111",
      type: "extension",
    });
    expect(result.success).toBe(false);
  });

  it("rejects requestedDate for excusal", () => {
    const result = createEmployeeRequestSchema.safeParse({
      taskId: "11111111-1111-4111-8111-111111111111",
      type: "excusal",
      requestedDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid extension and excusal", () => {
    expect(
      createEmployeeRequestSchema.safeParse({
        taskId: "11111111-1111-4111-8111-111111111111",
        type: "extension",
        requestedDate: "2026-08-01",
      }).success,
    ).toBe(true);
    expect(
      createEmployeeRequestSchema.safeParse({
        taskId: "11111111-1111-4111-8111-111111111111",
        type: "excusal",
      }).success,
    ).toBe(true);
  });
});
