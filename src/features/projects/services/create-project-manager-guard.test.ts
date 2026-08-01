import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/projects/services/assert-can-access-project", () => ({
  assertCanCreateProject: vi.fn(async () => undefined),
}));

import { createProject } from "@/features/projects/services/projects";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

const createAdminClientMock = vi.mocked(createAdminClient);

function makeAdmin(): AppUser {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("createProject manager guard", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it("rejects creating a project in a department without a manager", async () => {
    createAdminClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "dept-1",
                status: "active",
                manager_id: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    await expect(
      createProject(makeAdmin(), {
        departmentId: "11111111-1111-4111-8111-111111111111",
        name: "New project",
        description: null,
        status: "active",
        priority: "medium",
        startDate: null,
        endDate: null,
        memberIds: [],
      }),
    ).rejects.toMatchObject({
      code: "DEPARTMENT_HAS_NO_MANAGER",
      status: 409,
    });
  });
});
