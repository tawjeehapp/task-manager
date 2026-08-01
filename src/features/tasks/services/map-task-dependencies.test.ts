import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { mapTask } from "@/features/tasks/services/tasks";
import type { IncompleteDependencySummary } from "@/features/tasks/types/task.types";

const baseRow = {
  id: "t1",
  project_id: "p1",
  title: "Dependent task",
  description: null,
  status: "blocked" as const,
  priority: "medium" as const,
  assigned_to: "u1",
  created_by: "u2",
  start_date: null,
  due_date: "2026-08-04",
  estimated_hours: null,
  progress_percentage: 0,
  completed_at: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  project: {
    id: "p1",
    name: "Website",
    department_id: "d1",
  },
  assignee: {
    id: "u1",
    full_name: "Assignee",
    employee_number: "1001",
  },
  created_by_user: null,
};

describe("mapTask dependency aggregates", () => {
  it("passes incompleteDependencies through to the Task", () => {
    const incompleteDependencies: IncompleteDependencySummary[] = [
      {
        id: "blocker-1",
        title: "Prerequisite design",
        status: "in_progress",
        dueDate: "2026-08-02",
        assignee: {
          id: "u3",
          fullName: "Blocker Owner",
          employeeNumber: "1003",
        },
      },
    ];

    const task = mapTask(baseRow, {
      dependencyCount: 1,
      incompleteDependencyCount: 1,
      incompleteDependencyTitles: ["Prerequisite design"],
      incompleteDependencies,
    });

    expect(task.incompleteDependencyCount).toBe(1);
    expect(task.incompleteDependencyTitles).toEqual(["Prerequisite design"]);
    expect(task.incompleteDependencies).toEqual(incompleteDependencies);
  });

  it("defaults incompleteDependencies to undefined when omitted", () => {
    const task = mapTask(baseRow);
    expect(task.incompleteDependencies).toBeUndefined();
  });

  it("omits employee numbers when includeEmployeeNumber is false", () => {
    const incompleteDependencies: IncompleteDependencySummary[] = [
      {
        id: "blocker-1",
        title: "Prerequisite design",
        status: "in_progress",
        dueDate: "2026-08-02",
        assignee: {
          id: "u3",
          fullName: "Blocker Owner",
          employeeNumber: "1003",
        },
      },
    ];

    const task = mapTask(baseRow, {
      incompleteDependencies,
      includeEmployeeNumber: false,
    });

    expect(task.assignee).toEqual({ id: "u1", fullName: "Assignee" });
    expect(task.incompleteDependencies?.[0]?.assignee).toEqual({
      id: "u3",
      fullName: "Blocker Owner",
    });
  });
});
