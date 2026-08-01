import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  getManagedDepartmentId: vi.fn(),
}));

vi.mock("@/lib/permissions/get-role-permissions", () => ({
  getPermissionsForRole: vi.fn(),
}));

vi.mock("@/features/tasks/services/assert-can-access-task", () => ({
  assertCanAccessTask: vi.fn(),
}));

vi.mock("@/features/tasks/services/activity-logs", () => ({
  logTaskActivity: vi.fn(),
}));

import {
  areDependenciesSatisfied,
  isDependencyHierarchyAllowed,
  statusRequiresCompletedDependencies,
} from "@/features/tasks/services/dependencies";
import { computeEmployeeWorkload } from "@/features/tasks/services/workload";
import {
  addTaskDependencySchema,
  listTaskActivityQuerySchema,
} from "@/features/tasks/schemas/dependency.schema";

const TASK_A = "11111111-1111-4111-8111-111111111111";
const TASK_B = "22222222-2222-4222-8222-222222222222";

describe("dependency status rules", () => {
  it("requires completed dependencies for in_progress and completed", () => {
    expect(statusRequiresCompletedDependencies("in_progress")).toBe(true);
    expect(statusRequiresCompletedDependencies("completed")).toBe(true);
    expect(statusRequiresCompletedDependencies("todo")).toBe(false);
    expect(statusRequiresCompletedDependencies("blocked")).toBe(false);
  });

  it("is satisfied only when every prerequisite is completed", () => {
    expect(areDependenciesSatisfied([])).toBe(true);
    expect(areDependenciesSatisfied(["completed"])).toBe(true);
    expect(areDependenciesSatisfied(["completed", "completed"])).toBe(true);
    expect(areDependenciesSatisfied(["completed", "todo"])).toBe(false);
    expect(areDependenciesSatisfied(["in_progress"])).toBe(false);
  });
});

describe("dependency hierarchy rules", () => {
  it("always allows dependencies regardless of former parent hierarchy", () => {
    expect(
      isDependencyHierarchyAllowed({
        taskParentTaskId: null,
        dependsOnParentTaskId: null,
      }),
    ).toBe(true);
    expect(
      isDependencyHierarchyAllowed({
        taskParentTaskId: null,
        dependsOnParentTaskId: "parent-1",
      }),
    ).toBe(true);
    expect(
      isDependencyHierarchyAllowed({
        taskParentTaskId: "parent-1",
        dependsOnParentTaskId: "parent-2",
      }),
    ).toBe(true);
  });
});

describe("dependency schemas", () => {
  it("requires dependsOnTaskId uuid", () => {
    expect(addTaskDependencySchema.safeParse({}).success).toBe(false);
    expect(
      addTaskDependencySchema.safeParse({ dependsOnTaskId: "bad" }).success,
    ).toBe(false);
    expect(
      addTaskDependencySchema.safeParse({ dependsOnTaskId: TASK_B }).success,
    ).toBe(true);
  });

  it("defaults activity pagination", () => {
    const result = listTaskActivityQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
    }
  });
});

describe("computeEmployeeWorkload", () => {
  it("counts non-terminal tasks and sums hours", () => {
    const result = computeEmployeeWorkload(TASK_A, [
      { status: "todo", estimatedHours: 4 },
      { status: "in_progress", estimatedHours: 6 },
      { status: "blocked", estimatedHours: null },
      { status: "completed", estimatedHours: 99 },
    ]);

    expect(result).toEqual({
      userId: TASK_A,
      activeTaskCount: 3,
      estimatedHours: 10,
    });
  });

  it("returns zeros when no active tasks", () => {
    expect(
      computeEmployeeWorkload(TASK_B, [
        { status: "completed", estimatedHours: 10 },
      ]),
    ).toEqual({
      userId: TASK_B,
      activeTaskCount: 0,
      estimatedHours: 0,
    });
  });
});
