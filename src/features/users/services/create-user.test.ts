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
});
