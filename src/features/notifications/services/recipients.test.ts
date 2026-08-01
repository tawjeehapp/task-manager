import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  getCurrentDepartmentIdForUser: vi.fn(),
  getManagedDepartmentId: vi.fn(),
}));

import { getCurrentDepartmentIdForUser } from "@/features/departments/services/membership-helpers";
import {
  listApproverUserIdsForRequester,
  listApproverUserIdsOrThrow,
} from "@/features/notifications/services/recipients";
import { createAdminClient } from "@/lib/supabase/admin";

const createAdminClientMock = vi.mocked(createAdminClient);
const getCurrentDepartmentIdMock = vi.mocked(getCurrentDepartmentIdForUser);

describe("listApproverUserIdsForRequester", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getCurrentDepartmentIdMock.mockReset();
  });

  it("returns only admins for department_manager requesters", async () => {
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              neq: async () => ({
                data: [{ id: "admin-1" }, { id: "admin-2" }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as never);

    const ids = await listApproverUserIdsForRequester(
      "mgr-1",
      "department_manager",
    );
    expect(ids).toEqual(["admin-1", "admin-2"]);
  });

  it("returns only the department manager for employees", async () => {
    getCurrentDepartmentIdMock.mockResolvedValue("dept-1");

    createAdminClientMock.mockImplementation(() => {
      return {
        from: (table: string) => {
          if (table === "departments") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { manager_id: "mgr-1" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "mgr-1" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      } as never;
    });

    const ids = await listApproverUserIdsForRequester("emp-1", "employee");
    expect(ids).toEqual(["mgr-1"]);
  });

  it("throws NO_DEPARTMENT_MANAGER for employees with no approver", async () => {
    getCurrentDepartmentIdMock.mockResolvedValue(null);

    await expect(
      listApproverUserIdsOrThrow("emp-1", "employee"),
    ).rejects.toMatchObject({
      code: "NO_DEPARTMENT_MANAGER",
      status: 409,
    });
  });

  it("allows department_manager with empty admin list through orThrow", async () => {
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              neq: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as never);

    await expect(
      listApproverUserIdsOrThrow("mgr-1", "department_manager"),
    ).resolves.toEqual([]);
  });
});
