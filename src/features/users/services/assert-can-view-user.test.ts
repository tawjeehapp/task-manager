import { describe, expect, it } from "vitest";

import { assertCanViewUser } from "@/features/users/services/assert-can-view-user";
import type { AppUser } from "@/lib/auth/types";
import { ApiError } from "@/lib/api/errors";

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
  it("allows admin to view any user", () => {
    expect(() =>
      assertCanViewUser(makeUser({ role: "admin" }), "other-id"),
    ).not.toThrow();
  });

  it("allows employee to view own profile", () => {
    expect(() =>
      assertCanViewUser(makeUser({ id: "self", role: "employee" }), "self"),
    ).not.toThrow();
  });

  it("blocks employee from viewing others", () => {
    expect(() =>
      assertCanViewUser(makeUser({ id: "self", role: "employee" }), "other"),
    ).toThrow(ApiError);
  });

  it("blocks department_manager from viewing others in M1", () => {
    expect(() =>
      assertCanViewUser(
        makeUser({ id: "mgr", role: "department_manager" }),
        "other",
      ),
    ).toThrow(ApiError);
  });
});
