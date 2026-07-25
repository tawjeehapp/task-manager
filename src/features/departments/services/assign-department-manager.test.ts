import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignDepartmentManager } from "@/features/departments/services/departments";

const createAdminClientMock = vi.mocked(createAdminClient);

type QueryResult = { data: unknown; error: unknown };

function chain(result: QueryResult) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = self;
  api.insert = self;
  api.update = self;
  api.eq = self;
  api.neq = self;
  api.order = self;
  api.in = self;
  api.maybeSingle = async () => result;
  api.single = async () => result;
  return api;
}

describe("assignDepartmentManager", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it("rejects silent overwrite when manager already assigned", async () => {
    let call = 0;
    createAdminClientMock.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return {
          from: () =>
            chain({
              data: {
                id: "dept-1",
                name: "A",
                description: null,
                manager_id: "mgr-old",
                status: "active",
                created_at: "",
                updated_at: "",
              },
              error: null,
            }),
        } as never;
      }
      return { from: () => chain({ data: null, error: null }) } as never;
    });

    await expect(
      assignDepartmentManager("dept-1", "mgr-new", false),
    ).rejects.toMatchObject({
      code: "MANAGER_ALREADY_ASSIGNED",
      status: 409,
    });
  });

  it("rejects non department_manager role", async () => {
    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "users") {
            return chain({
              data: {
                id: "mgr-new",
                auth_user_id: "a",
                employee_number: "2001",
                full_name: "Emp",
                email: "2001@task-manager.com",
                phone: null,
                avatar_url: null,
                role: "employee",
                is_active: true,
                must_change_password: false,
                created_at: "",
                updated_at: "",
              },
              error: null,
            });
          }
          return chain({
            data: {
              id: "dept-1",
              name: "A",
              description: null,
              manager_id: null,
              status: "active",
              created_at: "",
              updated_at: "",
            },
            error: null,
          });
        },
      } as never;
    });

    await expect(
      assignDepartmentManager("dept-1", "mgr-new", false),
    ).rejects.toMatchObject({ code: "INVALID_MANAGER_ROLE" });
  });

  it("rejects admin as department manager", async () => {
    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "users") {
            return chain({
              data: {
                id: "admin-1",
                auth_user_id: "a",
                employee_number: "0000",
                full_name: "Admin",
                email: "0000@task-manager.com",
                phone: null,
                avatar_url: null,
                role: "admin",
                is_active: true,
                must_change_password: false,
                created_at: "",
                updated_at: "",
              },
              error: null,
            });
          }
          return chain({
            data: {
              id: "dept-1",
              name: "A",
              description: null,
              manager_id: null,
              status: "active",
              created_at: "",
              updated_at: "",
            },
            error: null,
          });
        },
      } as never;
    });

    await expect(
      assignDepartmentManager("dept-1", "admin-1", false),
    ).rejects.toMatchObject({ code: "ADMIN_CANNOT_MANAGE_DEPARTMENT" });
  });

  it("rejects manager who already manages another department", async () => {
    createAdminClientMock.mockImplementation(() => {
      let departmentsSelect = 0;
      return {
        from: (table: string) => {
          if (table === "users") {
            return chain({
              data: {
                id: "mgr-new",
                auth_user_id: "a",
                employee_number: "2001",
                full_name: "Mgr",
                email: "2001@task-manager.com",
                phone: null,
                avatar_url: null,
                role: "department_manager",
                is_active: true,
                must_change_password: false,
                created_at: "",
                updated_at: "",
              },
              error: null,
            });
          }
          departmentsSelect += 1;
          if (departmentsSelect === 1) {
            return chain({
              data: {
                id: "dept-1",
                name: "A",
                description: null,
                manager_id: null,
                status: "active",
                created_at: "",
                updated_at: "",
              },
              error: null,
            });
          }
          return chain({
            data: { id: "dept-2" },
            error: null,
          });
        },
      } as never;
    });

    await expect(
      assignDepartmentManager("dept-1", "mgr-new", false),
    ).rejects.toMatchObject({ code: "MANAGER_ALREADY_HAS_DEPARTMENT" });
  });
});
