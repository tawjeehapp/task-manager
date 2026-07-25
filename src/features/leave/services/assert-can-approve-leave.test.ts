import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  sharesManagedDepartmentWith: vi.fn(),
}));

import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import {
  assertCanApproveLeave,
  assertCanViewLeaveUser,
} from "@/features/leave/services/assert-can-approve-leave";
import type { AppUser } from "@/lib/auth/types";

const sharesMock = vi.mocked(sharesManagedDepartmentWith);

function user(
  overrides: Partial<AppUser> & Pick<AppUser, "id" | "role">,
): AppUser {
  return {
    authUserId: "auth",
    employeeNumber: "1000",
    fullName: "Test",
    email: "1000@task-manager.com",
    phone: null,
    avatarUrl: null,
    isActive: true,
    mustChangePassword: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("assertCanApproveLeave", () => {
  beforeEach(() => {
    sharesMock.mockReset();
  });

  it("blocks self-approval", async () => {
    await expect(
      assertCanApproveLeave(user({ id: "a", role: "admin" }), "a"),
    ).rejects.toMatchObject({ code: "CANNOT_APPROVE_OWN" });
  });

  it("allows admin for others", async () => {
    await expect(
      assertCanApproveLeave(user({ id: "a", role: "admin" }), "b"),
    ).resolves.toBeUndefined();
  });

  it("allows manager when sharing department", async () => {
    sharesMock.mockResolvedValue(true);
    await expect(
      assertCanApproveLeave(
        user({ id: "m", role: "department_manager" }),
        "e",
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks manager outside department", async () => {
    sharesMock.mockResolvedValue(false);
    await expect(
      assertCanApproveLeave(
        user({ id: "m", role: "department_manager" }),
        "e",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("assertCanViewLeaveUser", () => {
  beforeEach(() => {
    sharesMock.mockReset();
  });

  it("allows self", async () => {
    await expect(
      assertCanViewLeaveUser(user({ id: "a", role: "employee" }), "a"),
    ).resolves.toBeUndefined();
  });
});
