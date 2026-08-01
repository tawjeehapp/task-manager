import { describe, expect, it } from "vitest";

import {
  attendanceSummaryQuerySchema,
  employeeWorkloadQuerySchema,
  taskCompletionQuerySchema,
  workLogSummaryQuerySchema,
} from "@/features/reports/schemas/report.schema";

describe("report schemas", () => {
  it("defaults task completion pagination and sort", () => {
    const parsed = taskCompletionQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.sortBy).toBe("completionRate");
    expect(parsed.sortDir).toBe("desc");
  });

  it("rejects invalid page sizes", () => {
    expect(taskCompletionQuerySchema.safeParse({ pageSize: "10" }).success).toBe(
      false,
    );
  });

  it("accepts date filters", () => {
    const parsed = attendanceSummaryQuerySchema.parse({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
    expect(parsed.dateFrom).toBe("2026-07-01");
    expect(parsed.dateTo).toBe("2026-07-31");
  });

  it("defaults employee workload sort", () => {
    const parsed = employeeWorkloadQuerySchema.parse({});
    expect(parsed.sortBy).toBe("capacityPercent");
  });

  it("accepts work log project and task filters", () => {
    const parsed = workLogSummaryQuerySchema.parse({
      projectId: "11111111-1111-4111-8111-111111111111",
      taskId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.projectId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.taskId).toBe("22222222-2222-4222-8222-222222222222");
  });
});
