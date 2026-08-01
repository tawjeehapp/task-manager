import { describe, expect, it } from "vitest";

import {
  buildAllocationsFromForm,
  initialTaskRowsFromAllocations,
} from "@/features/attendance/lib/build-allocations-from-form";

const TASK_A = "11111111-1111-4111-8111-111111111111";
const TASK_B = "22222222-2222-4222-8222-222222222222";

describe("buildAllocationsFromForm", () => {
  it("returns task allocations only when they fill net exactly", () => {
    const result = buildAllocationsFromForm({
      taskRows: [
        { taskId: TASK_A, hours: "5" },
        { taskId: TASK_B, hours: "2.5" },
      ],
      netHours: 7.5,
      remainderReason: "",
    });

    expect(result).toEqual({
      ok: true,
      remainingHours: 0,
      allocations: [
        { type: "task", taskId: TASK_A, hours: 5 },
        { type: "task", taskId: TASK_B, hours: 2.5 },
      ],
    });
  });

  it("auto-adds general remainder with reason when leftover > 0", () => {
    const result = buildAllocationsFromForm({
      taskRows: [{ taskId: TASK_A, hours: "5" }],
      netHours: 7.5,
      remainderReason: "  Meetings and email  ",
    });

    expect(result).toEqual({
      ok: true,
      remainingHours: 2.5,
      allocations: [
        { type: "task", taskId: TASK_A, hours: 5 },
        {
          type: "general",
          reason: "Meetings and email",
          hours: 2.5,
        },
      ],
    });
  });

  it("allows all-general day with reason and no tasks", () => {
    const result = buildAllocationsFromForm({
      taskRows: [{ taskId: "", hours: "" }],
      netHours: 8,
      remainderReason: "Training day",
    });

    expect(result).toEqual({
      ok: true,
      remainingHours: 8,
      allocations: [
        { type: "general", reason: "Training day", hours: 8 },
      ],
    });
  });

  it("requires reason when leftover > 0", () => {
    const result = buildAllocationsFromForm({
      taskRows: [{ taskId: TASK_A, hours: "3" }],
      netHours: 7.5,
      remainderReason: "x",
    });

    expect(result).toEqual({
      ok: false,
      code: "reason_required",
      remainingHours: 4.5,
    });
  });

  it("rejects over-allocation", () => {
    const result = buildAllocationsFromForm({
      taskRows: [{ taskId: TASK_A, hours: "9" }],
      netHours: 7.5,
      remainderReason: "",
    });

    expect(result).toEqual({
      ok: false,
      code: "over_allocated",
      remainingHours: -1.5,
    });
  });

  it("rejects duplicate tasks", () => {
    const result = buildAllocationsFromForm({
      taskRows: [
        { taskId: TASK_A, hours: "3" },
        { taskId: TASK_A, hours: "2" },
      ],
      netHours: 7.5,
      remainderReason: "other",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("duplicate_task");
    }
  });

  it("rejects incomplete task rows", () => {
    const result = buildAllocationsFromForm({
      taskRows: [{ taskId: TASK_A, hours: "" }],
      netHours: 7.5,
      remainderReason: "other work",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("incomplete_task_row");
    }
  });
});

describe("initialTaskRowsFromAllocations", () => {
  it("maps tasks and collapses general reasons", () => {
    const result = initialTaskRowsFromAllocations([
      { type: "task", taskId: TASK_A, hours: 4, title: "A" },
      { type: "general", reason: "Standup", hours: 1 },
      { type: "general", reason: "Admin", hours: 2 },
    ]);

    expect(result.rows).toEqual([
      { taskId: TASK_A, hours: "4", title: "A" },
    ]);
    expect(result.remainderReason).toBe("Standup; Admin");
  });

  it("returns an empty task row when only general allocations exist", () => {
    const result = initialTaskRowsFromAllocations([
      { type: "general", reason: "All day support", hours: 8 },
    ]);

    expect(result.rows).toEqual([{ taskId: "", hours: "" }]);
    expect(result.remainderReason).toBe("All day support");
  });
});
