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
import {
  assertCanCreateProject,
  assertCanManageProject,
  assertCanManageProjectContents,
} from "@/features/projects/services/assert-can-access-project";
import type { AppUser } from "@/lib/auth/types";

const createAdminClientMock = vi.mocked(createAdminClient);
const getManagedDepartmentIdMock = vi.mocked(getManagedDepartmentId);

const adminUser: AppUser = {
  id: "admin-1",
  authUserId: "auth-admin",
  employeeNumber: "0000",
  fullName: "Admin",
  email: "0000@task-manager.com",
  phone: null,
  avatarUrl: null,
  role: "admin",
  isActive: true,
  mustChangePassword: false,
  weeklyCapacityHours: 40,
  createdAt: "",
  updatedAt: "",
};

const managerUser: AppUser = {
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

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = self;
  api.eq = self;
  api.maybeSingle = async () => result;
  return api;
}

describe("project manage vs contents access", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
    createAdminClientMock.mockImplementation(
      () =>
        ({
          from: () =>
            chain({
              data: { id: "proj-1", department_id: "dept-1" },
              error: null,
            }),
        }) as never,
    );
    getManagedDepartmentIdMock.mockResolvedValue("dept-1");
  });

  it("allows only admins to create projects", async () => {
    await expect(assertCanCreateProject(adminUser)).resolves.toBeUndefined();
    await expect(assertCanCreateProject(managerUser)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows only admins to manage the project entity", async () => {
    await expect(
      assertCanManageProject(adminUser, "proj-1"),
    ).resolves.toEqual({ departmentId: "dept-1" });
    await expect(
      assertCanManageProject(managerUser, "proj-1"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("allows department managers to manage project contents", async () => {
    await expect(
      assertCanManageProjectContents(managerUser, "proj-1"),
    ).resolves.toEqual({ departmentId: "dept-1" });
  });
});
