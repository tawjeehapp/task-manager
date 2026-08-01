import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/users/services/create-user", () => ({
  countActiveAdmins: vi.fn().mockResolvedValue(2),
}));

import { deleteUser } from "@/features/users/services/delete-user";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const createAdminClientMock = vi.mocked(createAdminClient);

function makeActor(): AppUser {
  return {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("deleteUser", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it("rejects deleting a user who manages a department", async () => {
    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "users") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "mgr-1",
                      auth_user_id: "auth-mgr",
                      employee_number: "1001",
                      full_name: "Manager",
                      email: "1001@task-manager.com",
                      phone: null,
                      avatar_url: null,
                      role: "department_manager",
                      is_active: true,
                      must_change_password: false,
                      created_at: "",
                      updated_at: "",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "departments") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "dept-1" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
        auth: { admin: { deleteUser: vi.fn() } },
      } as never;
    });

    await expect(deleteUser(makeActor(), "mgr-1")).rejects.toMatchObject({
      code: "USER_MANAGES_DEPARTMENT",
      status: 409,
    });
  });
});
