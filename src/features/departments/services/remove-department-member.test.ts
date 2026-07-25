import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { removeDepartmentMember } from "@/features/departments/services/memberships";

const createAdminClientMock = vi.mocked(createAdminClient);

describe("removeDepartmentMember", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it("rejects removing the department manager until assignment is cleared", async () => {
    const membershipUpdate = vi.fn();

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "department_memberships") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: "mem-1",
                          department_id: "dept-1",
                          user_id: "mgr-1",
                          is_current: true,
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
              update: membershipUpdate,
            };
          }

          if (table === "departments") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "dept-1", manager_id: "mgr-1" },
                    error: null,
                  }),
                }),
              }),
            };
          }

          return {};
        },
      } as never;
    });

    await expect(removeDepartmentMember("dept-1", "mgr-1")).rejects.toMatchObject({
      code: "MEMBER_IS_DEPARTMENT_MANAGER",
      status: 409,
    });
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it("allows removing a non-manager member", async () => {
    const membershipUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "department_memberships") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: "mem-1",
                          department_id: "dept-1",
                          user_id: "emp-1",
                          is_current: true,
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
              update: membershipUpdate,
            };
          }

          if (table === "departments") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "dept-1", manager_id: "mgr-other" },
                    error: null,
                  }),
                }),
              }),
            };
          }

          return {};
        },
      } as never;
    });

    await removeDepartmentMember("dept-1", "emp-1");
    expect(membershipUpdate).toHaveBeenCalled();
  });
});
