import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  getManagedDepartmentId: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { createTask } from "@/features/tasks/services/tasks";
import type { AppUser } from "@/lib/auth/types";

const createAdminClientMock = vi.mocked(createAdminClient);
const getManagedDepartmentIdMock = vi.mocked(getManagedDepartmentId);

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
  createdAt: "",
  updatedAt: "",
};

type QueryResult = { data: unknown; error: unknown };

function chain(result: QueryResult, extras?: Record<string, unknown>) {
  const api: Record<string, unknown> = { ...extras };
  const self = () => api;
  api.select = self;
  api.insert = self;
  api.update = self;
  api.eq = self;
  api.neq = self;
  api.is = self;
  api.in = self;
  api.or = self;
  api.gte = self;
  api.lte = self;
  api.order = self;
  api.range = self;
  api.maybeSingle = async () => result;
  api.single = async () => result;
  return api;
}

describe("createTask subtask depth", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
    getManagedDepartmentIdMock.mockResolvedValue("dept-1");
  });

  it("rejects creating a subtask under another subtask", async () => {
    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "projects") {
            return chain({
              data: { id: "proj-1", department_id: "dept-1", status: "active" },
              error: null,
            });
          }
          if (table === "tasks") {
            return chain({
              data: {
                id: "parent-sub",
                project_id: "proj-1",
                parent_task_id: "root-1",
              },
              error: null,
            });
          }
          return chain({ data: null, error: null });
        },
      } as never;
    });

    await expect(
      createTask(manager, {
        projectId: "proj-1",
        parentTaskId: "parent-sub",
        title: "مستوى ثالث",
        description: null,
        status: "todo",
        priority: "medium",
        assignedTo: null,
        startDate: null,
        dueDate: null,
        estimatedHours: null,
      }),
    ).rejects.toMatchObject({
      code: "SUBTASK_DEPTH_EXCEEDED",
      status: 409,
    });
  });

  it("rejects creating tasks on archived projects", async () => {
    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "projects") {
            return chain({
              data: {
                id: "proj-1",
                department_id: "dept-1",
                status: "archived",
              },
              error: null,
            });
          }
          return chain({ data: null, error: null });
        },
      } as never;
    });

    await expect(
      createTask(manager, {
        projectId: "proj-1",
        parentTaskId: null,
        title: "مهمة",
        description: null,
        status: "todo",
        priority: "medium",
        assignedTo: null,
        startDate: null,
        dueDate: null,
        estimatedHours: null,
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_ARCHIVED",
      status: 409,
    });
  });
});
