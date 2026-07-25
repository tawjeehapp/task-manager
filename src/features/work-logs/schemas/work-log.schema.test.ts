import { describe, expect, it } from "vitest";

import {
  createWorkLogSchema,
  updateWorkLogSchema,
} from "@/features/work-logs/schemas/work-log.schema";

describe("work log schemas", () => {
  it("accepts valid create payload", () => {
    const result = createWorkLogSchema.safeParse({
      taskId: "a1111111-1111-4111-8111-111111111111",
      date: "2026-07-25",
      hours: 2.5,
      description: "عمل",
    });
    expect(result.success).toBe(true);
  });

  it("requires positive hours", () => {
    const result = createWorkLogSchema.safeParse({
      taskId: "a1111111-1111-4111-8111-111111111111",
      date: "2026-07-25",
      hours: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty update", () => {
    expect(updateWorkLogSchema.safeParse({}).success).toBe(false);
  });
});
