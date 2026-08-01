import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { createUser } from "@/features/users/services/create-user";

describe("createUser compensating transaction", () => {
  it("deletes auth user when profile insert fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
    const createUserAuth = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-new" } },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "insert failed" },
                }),
              }),
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          createUser: createUserAuth,
          deleteUser,
        },
      },
    } as never);

    await expect(
      createUser({
        employeeNumber: "2222",
        fullName: "Test User",
        phone: null,
        role: "employee",
        weeklyCapacityHours: 40,
      }),
    ).rejects.toThrow();

    expect(createUserAuth).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("auth-new");
  });

  it("rolls back profile and auth when membership insert fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ data: null, error: null });
    const createUserAuth = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-new" } },
      error: null,
    });
    const deleteProfile = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const profileRow = {
      id: "user-new",
      auth_user_id: "auth-new",
      employee_number: "3333",
      full_name: "New Employee",
      email: "3333@task-manager.com",
      phone: null,
      avatar_url: null,
      role: "employee",
      is_active: true,
      must_change_password: true,
      weekly_capacity_hours: 40,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: profileRow,
                  error: null,
                }),
              }),
            }),
            delete: deleteProfile,
          };
        }
        if (table === "department_memberships") {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "membership failed" },
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          createUser: createUserAuth,
          deleteUser,
        },
      },
    } as never);

    await expect(
      createUser(
        {
          employeeNumber: "3333",
          fullName: "New Employee",
          phone: null,
          role: "employee",
          weeklyCapacityHours: 40,
        },
        { departmentId: "dept-1" },
      ),
    ).rejects.toMatchObject({ code: "ADD_MEMBERSHIP_FAILED" });

    expect(deleteProfile).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("auth-new");
  });
});
