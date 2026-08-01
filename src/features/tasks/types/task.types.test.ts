import { describe, expect, it } from "vitest";

import {
  MANUAL_TASK_STATUSES,
  selectableTaskStatuses,
} from "@/features/tasks/types/task.types";

describe("selectableTaskStatuses", () => {
  it("excludes blocked for non-blocked tasks", () => {
    expect(selectableTaskStatuses("todo")).toEqual(MANUAL_TASK_STATUSES);
    expect(selectableTaskStatuses("in_progress")).toEqual(MANUAL_TASK_STATUSES);
    expect(selectableTaskStatuses("completed")).toEqual(MANUAL_TASK_STATUSES);
    expect(selectableTaskStatuses("todo")).not.toContain("blocked");
  });

  it("includes blocked only when it is the current status", () => {
    expect(selectableTaskStatuses("blocked")).toEqual([
      "blocked",
      ...MANUAL_TASK_STATUSES,
    ]);
  });
});
