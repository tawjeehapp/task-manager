import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  sharesManagedDepartmentWith: vi.fn(),
}));

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import { assertCanManageUser } from "@/features/users/services/assert-can-manage-user";

const createAdminClientMock = vi.mocked(createAdminClient);
const sharesMock = vi.mocked(sharesManagedDepartmentWith);

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: "actor-1",
    authUserId: "auth-1",
    employeeNumber: "1001",
    fullName: "Actor",
    email: "1001@task-manager.com",
    phone: null,
    avatarUrl: null,
    role: "employee",
    isActive: true,
    mustChangePassword: false,
    weeklyCapacityHours: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockTargetUser(target: Partial<AppUser> & { id: string }) {
  const row = {
    id: target.id,
    auth_user_id: target.authUserId ?? "auth-t",
    employee_number: target.employeeNumber ?? "2000",
    full_name: target.fullName ?? "Target",
    email: target.email ?? "2000@task-manager.com",
    phone: null,
    avatar_url: null,
    role: target.role ?? "employee",
    is_active: target.isActive ?? true,
    must_change_password: false,
    weekly_capacity_hours: target.weeklyCapacityHours ?? 40,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  createAdminClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  } as never);
}

describe("assertCanManageUser", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    sharesMock.mockReset();
  });

  it("allows admin to manage any user", async () => {
    mockTargetUser({ id: "target", role: "department_manager" });
    await expect(
      assertCanManageUser(makeUser({ role: "admin" }), "target"),
    ).resolves.toBeUndefined();
  });

  it("allows manager to manage subordinate employee", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanManageUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks manager from managing another department_manager", async () => {
    mockTargetUser({ id: "target", role: "department_manager" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanManageUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("blocks manager from managing admin", async () => {
    mockTargetUser({ id: "target", role: "admin" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanManageUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks manager from managing outsider employee", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    sharesMock.mockResolvedValue(false);
    await expect(
      assertCanManageUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("blocks employee from managing anyone", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanManageUser(makeUser({ role: "employee" }), "target"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
