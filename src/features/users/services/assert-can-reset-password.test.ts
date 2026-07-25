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
import { assertCanResetPassword } from "@/features/users/services/assert-can-reset-password";

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

describe("assertCanResetPassword", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    sharesMock.mockReset();
  });

  it("blocks self reset", async () => {
    await expect(
      assertCanResetPassword(makeUser({ id: "same", role: "admin" }), "same"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin to reset others", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    await expect(
      assertCanResetPassword(makeUser({ role: "admin" }), "target"),
    ).resolves.toBeUndefined();
  });

  it("allows manager to reset subordinate", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanResetPassword(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks manager from resetting admin", async () => {
    mockTargetUser({ id: "target", role: "admin" });
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanResetPassword(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("blocks manager from resetting outsider", async () => {
    mockTargetUser({ id: "target", role: "employee" });
    sharesMock.mockResolvedValue(false);
    await expect(
      assertCanResetPassword(
        makeUser({ id: "mgr", role: "department_manager" }),
        "target",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
