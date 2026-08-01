import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { assertCanAccessTask } from "@/features/tasks/services/assert-can-access-task";
import { addTaskDependency } from "@/features/tasks/services/dependencies";
import type { AppUser } from "@/lib/auth/types";

const createAdminClientMock = vi.mocked(createAdminClient);
const getManagedDepartmentIdMock = vi.mocked(getManagedDepartmentId);
const getPermissionsForRoleMock = vi.mocked(getPermissionsForRole);
const assertCanAccessTaskMock = vi.mocked(assertCanAccessTask);

const manager: AppUser = {
  id: "mgr-1",
  authUserId: "auth-mgr",
  employeeNumber: "1001",
  fullName: "Manager",
  email: "1001@task-manager.com",
  phone: null,
  avatarUrl: null,
  role: "department_manager",
  isActive: true,
  mustChangePassword: false,
  weeklyCapacityHours: 40,
  createdAt: "",
  updatedAt: "",
};

type QueryResult = { data: unknown; error: unknown };

function chain(result: QueryResult, extras?: Record<string, unknown>) {
  const api: Record<string, unknown> = { ...extras };
  const self = () => api;
  api.select ??= self;
  api.insert ??= self;
  api.update ??= self;
  api.delete ??= self;
  api.eq ??= self;
  api.neq ??= self;
  api.is ??= self;
  api.in ??= self;
  api.or ??= self;
  api.order ??= self;
  api.range ??= self;
  if (!api.maybeSingle) {
    api.maybeSingle = async () => result;
  }
  if (!api.single) {
    api.single = async () => result;
  }
  if (!api.then) {
    // Supabase builders are thenable; resolve to the query result.
    api.then = (
      onFulfilled?: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
  }
  return api;
}

describe("addTaskDependency", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
    getPermissionsForRoleMock.mockReset();
    assertCanAccessTaskMock.mockReset();

    getManagedDepartmentIdMock.mockResolvedValue("dept-1");
    getPermissionsForRoleMock.mockResolvedValue(["task.assign"]);
    assertCanAccessTaskMock.mockResolvedValue({
      projectId: "proj-1",
      assignedTo: null,
      departmentId: "dept-1",
    });
  });

  it("rejects self dependency", async () => {
    await expect(
      addTaskDependency(manager, "task-1", { dependsOnTaskId: "task-1" }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_SELF" });
  });

  it("rejects cross-project dependency", async () => {
    const taskResults = [
      {
        data: {
          id: "task-1",
          project_id: "proj-1",
          status: "todo",
        },
        error: null,
      },
      {
        data: {
          id: "task-2",
          project_id: "proj-other",
          status: "todo",
          title: "Other",
        },
        error: null,
      },
    ];
    let taskIndex = 0;

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "tasks") {
            return chain(
              { data: null, error: null },
              {
                maybeSingle: async () => {
                  const result = taskResults[taskIndex] ?? {
                    data: null,
                    error: null,
                  };
                  taskIndex += 1;
                  return result;
                },
              },
            );
          }
          return chain({ data: [], error: null });
        },
      } as never;
    });

    await expect(
      addTaskDependency(manager, "task-1", { dependsOnTaskId: "task-2" }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_PROJECT_MISMATCH" });
  });

  it("rejects cyclic dependency", async () => {
    const taskResults = [
      {
        data: {
          id: "task-1",
          project_id: "proj-1",
          status: "todo",
        },
        error: null,
      },
      {
        data: {
          id: "task-2",
          project_id: "proj-1",
          status: "todo",
          title: "Other",
        },
        error: null,
      },
    ];
    let taskIndex = 0;

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "tasks") {
            return chain(
              { data: null, error: null },
              {
                maybeSingle: async () => {
                  const result = taskResults[taskIndex] ?? {
                    data: null,
                    error: null,
                  };
                  taskIndex += 1;
                  return result;
                },
              },
            );
          }
          if (table === "task_dependencies") {
            // task-2 already depends on task-1 → adding task-1 → task-2 cycles
            return chain({
              data: [{ depends_on_task_id: "task-1" }],
              error: null,
            });
          }
          return chain({ data: [], error: null });
        },
      } as never;
    });

    await expect(
      addTaskDependency(manager, "task-1", { dependsOnTaskId: "task-2" }),
    ).rejects.toMatchObject({ code: "DEPENDENCY_CYCLE" });
  });
});
