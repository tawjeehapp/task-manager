import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  sharesManagedDepartmentWith: vi.fn(),
}));

import { assertCanApproveAttendance } from "@/features/attendance/services/assert-can-approve-attendance";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import type { AppUser } from "@/lib/auth/types";

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

describe("assertCanApproveAttendance", () => {
  beforeEach(() => {
    sharesMock.mockReset();
  });

  it("blocks approving own attendance", async () => {
    await expect(
      assertCanApproveAttendance(
        makeUser({ id: "same", role: "admin" }),
        "same",
      ),
    ).rejects.toMatchObject({ code: "CANNOT_APPROVE_OWN" });
  });

  it("allows admin for others", async () => {
    await expect(
      assertCanApproveAttendance(makeUser({ role: "admin" }), "other"),
    ).resolves.toBeUndefined();
  });

  it("allows manager for department members", async () => {
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanApproveAttendance(
        makeUser({ role: "department_manager" }),
        "sub",
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks manager outside department", async () => {
    sharesMock.mockResolvedValue(false);
    await expect(
      assertCanApproveAttendance(
        makeUser({ role: "department_manager" }),
        "other",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
