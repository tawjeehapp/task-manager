import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  getManagedDepartmentId: vi.fn(),
}));

import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { listUsersQuerySchema } from "@/features/users/schemas/user.schema";
import { listUsersForViewer } from "@/features/users/services/get-users";

const createAdminClientMock = vi.mocked(createAdminClient);
const getManagedDepartmentIdMock = vi.mocked(getManagedDepartmentId);

function makeUser(overrides: Partial<AppUser>): AppUser {
  return {
    id: "viewer-1",
    authUserId: "auth-1",
    employeeNumber: "1001",
    fullName: "Viewer",
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

function mockEmptyUsersList() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
  };
  createAdminClientMock.mockReturnValue({
    from: vi.fn(() => chain),
  } as never);
  return chain;
}

describe("listUsersForViewer", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
  });

  it("does not scope when viewer is admin with manage permission", async () => {
    mockEmptyUsersList();
    const query = listUsersQuerySchema.parse({});

    await listUsersForViewer(
      makeUser({ role: "admin" }),
      query,
      true,
    );

    expect(getManagedDepartmentIdMock).not.toHaveBeenCalled();
  });

  it("scopes to managed department for department_manager even with manage permission", async () => {
    getManagedDepartmentIdMock.mockResolvedValue(null);
    createAdminClientMock.mockReturnValue({ from: vi.fn() } as never);

    const query = listUsersQuerySchema.parse({});
    const result = await listUsersForViewer(
      makeUser({ id: "mgr-1", role: "department_manager" }),
      query,
      true,
    );

    expect(getManagedDepartmentIdMock).toHaveBeenCalledWith("mgr-1");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
