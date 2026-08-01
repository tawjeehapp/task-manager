import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  getManagedDepartmentId: vi.fn(),
}));

vi.mock("@/features/tasks/services/activity-logs", () => ({
  logTaskActivity: vi.fn(),
}));

vi.mock("@/features/notifications/services/notifications", () => ({
  notifySafe: vi.fn(async () => undefined),
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

const createdRow = {
  id: "task-1",
  project_id: "proj-1",
  title: "مهمة",
  description: null,
  status: "todo",
  priority: "medium",
  assigned_to: null,
  created_by: "mgr-1",
  start_date: null,
  due_date: null,
  estimated_hours: 5,
  completed_at: null,
  created_at: "2026-07-31T00:00:00.000Z",
  updated_at: "2026-07-31T00:00:00.000Z",
  project: { id: "proj-1", name: "Project", department_id: "dept-1" },
  assignee: null,
  created_by_user: {
    id: "mgr-1",
    full_name: "Manager",
    employee_number: "1001",
  },
};

describe("createTask", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
    getManagedDepartmentIdMock.mockResolvedValue("dept-1");
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
        title: "مهمة",
        description: null,
        status: "todo",
        priority: "medium",
        assignedTo: null,
        startDate: null,
        dueDate: null,
        estimatedHours: 1,
        dependsOnTaskIds: [],
      }),
    ).rejects.toMatchObject({
      code: "PROJECT_ARCHIVED",
      status: 409,
    });
  });

  it("persists estimatedHours on any task create", async () => {
    let insertPayload: Record<string, unknown> | undefined;
    let projectCalls = 0;

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "projects") {
            projectCalls += 1;
            return chain({
              data: {
                id: "proj-1",
                department_id: "dept-1",
                status: "active",
              },
              error: null,
            });
          }
          if (table === "tasks") {
            const api = chain({ data: createdRow, error: null });
            api.insert = (payload: Record<string, unknown>) => {
              insertPayload = payload;
              return api;
            };
            return api;
          }
          if (table === "task_dependencies") {
            return chain({ data: [], error: null });
          }
          return chain({ data: null, error: null });
        },
      } as never;
    });

    const result = await createTask(manager, {
      projectId: "proj-1",
      title: "مهمة",
      description: null,
      status: "todo",
      priority: "medium",
      assignedTo: null,
      startDate: null,
      dueDate: null,
      estimatedHours: 5,
      dependsOnTaskIds: [],
    });

    expect(projectCalls).toBeGreaterThanOrEqual(1);
    expect(insertPayload).toMatchObject({
      project_id: "proj-1",
      title: "مهمة",
      estimated_hours: 5,
    });
    expect(result.estimatedHours).toBe(5);
  });
});
