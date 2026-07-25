import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  sharesManagedDepartmentWith: vi.fn(),
}));

import { assertCanViewUser } from "@/features/users/services/assert-can-view-user";
import type { AppUser } from "@/lib/auth/types";
import { ApiError } from "@/lib/api/errors";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";

const sharesManagedDepartmentWithMock = vi.mocked(sharesManagedDepartmentWith);

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: "user-1",
    authUserId: "auth-1",
    employeeNumber: "1001",
    fullName: "Test",
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

describe("assertCanViewUser", () => {
  beforeEach(() => {
    sharesManagedDepartmentWithMock.mockReset();
  });

  it("allows admin to view any user", async () => {
    await expect(
      assertCanViewUser(makeUser({ role: "admin" }), "other-id"),
    ).resolves.toBeUndefined();
  });

  it("allows employee to view own profile", async () => {
    await expect(
      assertCanViewUser(makeUser({ id: "self", role: "employee" }), "self"),
    ).resolves.toBeUndefined();
  });

  it("blocks employee from viewing others", async () => {
    await expect(
      assertCanViewUser(makeUser({ id: "self", role: "employee" }), "other"),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("allows department_manager to view subordinates", async () => {
    sharesManagedDepartmentWithMock.mockResolvedValue(true);
    await expect(
      assertCanViewUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "other",
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks department_manager from viewing outsiders", async () => {
    sharesManagedDepartmentWithMock.mockResolvedValue(false);
    await expect(
      assertCanViewUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "other",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
