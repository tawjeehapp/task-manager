import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/departments/services/membership-helpers", () => ({
  sharesManagedDepartmentWith: vi.fn(),
  getManagedDepartmentId: vi.fn(),
}));

vi.mock("@/features/attendance/services/compute-hours", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/attendance/services/compute-hours")
  >();
  return {
    ...actual,
    calendarDateInOrgTimezone: () => "2026-07-25",
  };
});

import {
  approveAttendance,
  listEligibleTasksForAttendance,
  rejectAttendance,
  resubmitAttendance,
  submitAttendance,
  updateAttendance,
} from "@/features/attendance/services/attendance";
import type { AttendanceRow } from "@/features/attendance/types/attendance.types";
import {
  getManagedDepartmentId,
  sharesManagedDepartmentWith,
} from "@/features/departments/services/membership-helpers";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/features/notifications/services/notifications", () => ({
  notifySafe: vi.fn(async () => undefined),
}));

vi.mock("@/features/notifications/services/recipients", () => ({
  listApproverUserIdsForRequester: vi.fn(async () => ["mgr-1"]),
}));

const createAdminClientMock = vi.mocked(createAdminClient);
const sharesMock = vi.mocked(sharesManagedDepartmentWith);
const getManagedDepartmentIdMock = vi.mocked(getManagedDepartmentId);

type QueryResult = { data: unknown; error: unknown };

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
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

function makeAttendanceRow(
  overrides: Partial<AttendanceRow> = {},
): AttendanceRow {
  return {
    id: "att-1",
    user_id: "emp-1",
    date: "2026-07-25",
    clock_in: "2026-07-25T05:00:00.000Z",
    clock_out: "2026-07-25T13:00:00.000Z",
    break_minutes: 30,
    total_hours: 7.5,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    eligible_tasks_snapshot: [],
    created_at: "2026-07-25T05:00:00.000Z",
    updated_at: "2026-07-25T13:00:00.000Z",
    user: {
      id: "emp-1",
      full_name: "Employee",
      employee_number: "2001",
    },
    approved_by_user: null,
    ...overrides,
  };
}

function chain(result: QueryResult, extras?: Record<string, unknown>) {
  const api: Record<string, unknown> = { ...extras };
  const self = () => api;
  api.select = self;
  api.insert = self;
  api.update = self;
  api.delete = self;
  api.eq = self;
  api.neq = self;
  api.is = self;
  api.in = self;
  api.or = self;
  api.gte = self;
  api.lte = self;
  api.not = self;
  api.order = self;
  api.range = self;
  api.maybeSingle = async () => result;
  api.single = async () => result;
  // Supabase builders are thenable when awaited without .single()
  api.then = (
    onfulfilled?: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return api;
}

describe("attendance service", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    sharesMock.mockReset();
    getManagedDepartmentIdMock.mockReset();
  });

  describe("updateAttendance", () => {
    it("blocks employee from modifying approved attendance", async () => {
      const row = makeAttendanceRow({
        user_id: "emp-1",
        status: "approved",
        approved_by: "admin-1",
        approved_at: "2026-07-25T14:00:00.000Z",
      });

      createAdminClientMock.mockReturnValue({
        from: () => chain({ data: row, error: null }),
      } as never);

      await expect(
        updateAttendance(makeUser({ id: "emp-1", role: "employee" }), "att-1", {
          breakMinutes: 15,
        }),
      ).rejects.toMatchObject({
        code: "ATTENDANCE_APPROVED_LOCKED",
        status: 409,
      });
    });

    it("blocks manager from modifying attendance timestamps/break", async () => {
      const row = makeAttendanceRow({ user_id: "emp-1", status: "pending" });

      createAdminClientMock.mockReturnValue({
        from: () => chain({ data: row, error: null }),
      } as never);

      await expect(
        updateAttendance(
          makeUser({ id: "mgr-1", role: "department_manager" }),
          "att-1",
          { breakMinutes: 15 },
        ),
      ).rejects.toMatchObject({
        code: "MANAGER_CANNOT_EDIT_ATTENDANCE",
        status: 403,
      });
    });

    it("allows pending attendance to be corrected by the owner", async () => {
      const existing = makeAttendanceRow({
        user_id: "emp-1",
        status: "pending",
      });
      const updated = makeAttendanceRow({
        ...existing,
        break_minutes: 15,
        total_hours: 7.75,
      });

      let updatePayload: Record<string, unknown> | undefined;
      let call = 0;

      createAdminClientMock.mockReturnValue({
        from: () => {
          call += 1;
          if (call === 1) {
            return chain({ data: existing, error: null });
          }
          const api = chain({ data: updated, error: null });
          api.update = (payload: Record<string, unknown>) => {
            updatePayload = payload;
            return api;
          };
          return api;
        },
      } as never);

      await updateAttendance(makeUser({ id: "emp-1", role: "employee" }), "att-1", {
        breakMinutes: 15,
      });

      expect(updatePayload).toMatchObject({
        status: "pending",
        break_minutes: 15,
      });
    });

    it("allows rejected attendance to be corrected and resubmitted", async () => {
      const existing = makeAttendanceRow({
        user_id: "emp-1",
        status: "rejected",
        approved_by: "mgr-1",
        approved_at: "2026-07-25T14:00:00.000Z",
        rejection_reason: "أوقات غير صحيحة",
        clock_in: "2026-07-25T05:00:00.000Z",
        clock_out: "2026-07-25T12:00:00.000Z",
        break_minutes: 30,
        total_hours: 6.5,
      });

      const updated = makeAttendanceRow({
        ...existing,
        clock_in: "2026-07-25T06:00:00.000Z",
        clock_out: "2026-07-25T14:00:00.000Z",
        break_minutes: 45,
        total_hours: 7.25,
        status: "pending",
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
      });

      let updatePayload: Record<string, unknown> | undefined;
      let call = 0;

      createAdminClientMock.mockReturnValue({
        from: () => {
          call += 1;
          if (call === 1) {
            return chain({ data: existing, error: null });
          }
          const api = chain({ data: updated, error: null });
          api.update = (payload: Record<string, unknown>) => {
            updatePayload = payload;
            return api;
          };
          return api;
        },
      } as never);

      const result = await updateAttendance(
        makeUser({ id: "emp-1", role: "employee" }),
        "att-1",
        {
          clockIn: "2026-07-25T06:00:00.000Z",
          clockOut: "2026-07-25T14:00:00.000Z",
          breakMinutes: 45,
        },
      );

      expect(updatePayload).toMatchObject({
        status: "pending",
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        clock_in: "2026-07-25T06:00:00.000Z",
        clock_out: "2026-07-25T14:00:00.000Z",
        break_minutes: 45,
      });
      expect(result.status).toBe("pending");
      expect(result.approvedBy).toBeNull();
      expect(result.approvedAt).toBeNull();
      expect(result.rejectionReason).toBeNull();
    });
  });

  describe("submitAttendance", () => {
    const baseInput = {
      date: "2026-07-25",
      clockIn: "08:00",
      clockOut: "16:00",
      breakMinutes: 30,
      allocations: [
        {
          type: "general" as const,
          reason: "أعمال إدارية",
          hours: 7.5,
        },
      ],
    };

    it("rejects when attendance already exists for the date", async () => {
      createAdminClientMock.mockReturnValue({
        from: () =>
          chain({
            data: { id: "att-1" },
            error: null,
          }),
      } as never);

      await expect(
        submitAttendance(makeUser({ id: "emp-1", role: "employee" }), baseInput),
      ).rejects.toMatchObject({
        code: "ATTENDANCE_EXISTS",
        status: 409,
      });
    });

    it("rejects when allocations do not equal net hours", async () => {
      await expect(
        submitAttendance(makeUser({ id: "emp-1", role: "employee" }), {
          ...baseInput,
          allocations: [
            {
              type: "task",
              taskId: "11111111-1111-1111-1111-111111111111",
              hours: 8,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: "ALLOCATION_MUST_EQUAL_NET_HOURS",
        status: 409,
      });
    });

    it("rejects tasks not assigned to the viewer", async () => {
      createAdminClientMock.mockReturnValue({
        from: (table: string) => {
          if (table === "tasks") {
            return chain({
              data: [
                {
                  id: "11111111-1111-1111-1111-111111111111",
                  assigned_to: "other-user",
                },
              ],
              error: null,
            });
          }
          return chain({ data: null, error: null });
        },
      } as never);

      await expect(
        submitAttendance(makeUser({ id: "emp-1", role: "employee" }), {
          ...baseInput,
          allocations: [
            {
              type: "task",
              taskId: "11111111-1111-1111-1111-111111111111",
              hours: 7.5,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: "TASK_NOT_ASSIGNED",
        status: 403,
      });
    });

    it("succeeds and creates attendance with task and general work logs", async () => {
      const inserted = makeAttendanceRow({
        user_id: "emp-1",
        date: "2026-07-25",
        clock_in: "2026-07-25T05:00:00.000Z",
        clock_out: "2026-07-25T13:00:00.000Z",
        break_minutes: 30,
        total_hours: 7.5,
        status: "pending",
        eligible_tasks_snapshot: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Task A",
            status: "todo",
          },
        ],
      });

      let attendancePayload: Record<string, unknown> | undefined;
      let workLogPayload: unknown;
      let taskCall = 0;
      let attendanceCall = 0;

      createAdminClientMock.mockReturnValue({
        from: (table: string) => {
          if (table === "tasks") {
            taskCall += 1;
            if (taskCall === 1) {
              return chain({
                data: [
                  {
                    id: "11111111-1111-1111-1111-111111111111",
                    assigned_to: "emp-1",
                  },
                ],
                error: null,
              });
            }
            return chain({
              data: [
                {
                  id: "11111111-1111-1111-1111-111111111111",
                  title: "Task A",
                  status: "todo",
                },
              ],
              error: null,
            });
          }
          if (table === "work_logs") {
            const api = chain({ data: null, error: null });
            api.insert = (payload: unknown) => {
              workLogPayload = payload;
              return api;
            };
            return api;
          }
          attendanceCall += 1;
          if (attendanceCall === 1) {
            return chain({ data: null, error: null });
          }
          const api = chain({ data: inserted, error: null });
          api.insert = (payload: Record<string, unknown>) => {
            attendancePayload = payload;
            return api;
          };
          return api;
        },
      } as never);

      const result = await submitAttendance(
        makeUser({ id: "emp-1", role: "employee" }),
        {
          ...baseInput,
          allocations: [
            {
              type: "task",
              taskId: "11111111-1111-1111-1111-111111111111",
              hours: 3,
            },
            {
              type: "general",
              reason: "متابعة بريد داخلي",
              hours: 4.5,
            },
          ],
        },
      );

      expect(attendancePayload).toMatchObject({
        user_id: "emp-1",
        date: "2026-07-25",
        break_minutes: 30,
        total_hours: 7.5,
        status: "pending",
        eligible_tasks_snapshot: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Task A",
            status: "todo",
          },
        ],
      });
      expect(attendancePayload?.clock_out).toBeTruthy();
      expect(workLogPayload).toEqual([
        {
          user_id: "emp-1",
          task_id: "11111111-1111-1111-1111-111111111111",
          date: "2026-07-25",
          hours: 3,
          description: null,
          approved_by: null,
        },
        {
          user_id: "emp-1",
          task_id: null,
          date: "2026-07-25",
          hours: 4.5,
          description: "متابعة بريد داخلي",
          approved_by: null,
        },
      ]);
      expect(result.id).toBe("att-1");
      expect(result.status).toBe("pending");
      expect(result.totalHours).toBe(7.5);
      expect(result.eligibleTasksSnapshot).toEqual([
        {
          id: "11111111-1111-1111-1111-111111111111",
          title: "Task A",
          status: "todo",
        },
      ]);
    });
  });

  describe("listEligibleTasksForAttendance", () => {
    it("returns assigned todo and in_progress tasks only", async () => {
      createAdminClientMock.mockReturnValue({
        from: () =>
          chain({
            data: [
              {
                id: "t-1",
                title: "Alpha",
                status: "todo",
              },
              {
                id: "t-2",
                title: "Beta",
                status: "in_progress",
              },
            ],
            error: null,
          }),
      } as never);

      const items = await listEligibleTasksForAttendance("emp-1");
      expect(items).toEqual([
        { id: "t-1", title: "Alpha", status: "todo" },
        { id: "t-2", title: "Beta", status: "in_progress" },
      ]);
    });
  });

  describe("resubmitAttendance", () => {
    it("blocks editing approved attendance", async () => {
      createAdminClientMock.mockReturnValue({
        from: () =>
          chain({
            data: makeAttendanceRow({
              user_id: "emp-1",
              status: "approved",
            }),
            error: null,
          }),
      } as never);

      await expect(
        resubmitAttendance(makeUser({ id: "emp-1" }), "att-1", {
          clockIn: "08:00",
          clockOut: "16:00",
          breakMinutes: 30,
          allocations: [
            {
              type: "general",
              reason: "أعمال إدارية",
              hours: 7.5,
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: "ATTENDANCE_APPROVED_LOCKED",
        status: 409,
      });
    });

    it("allows pending owner to resubmit with allocations", async () => {
      const existing = makeAttendanceRow({
        user_id: "emp-1",
        status: "pending",
        date: "2026-07-25",
      });
      const updated = makeAttendanceRow({
        ...existing,
        break_minutes: 0,
        total_hours: 8,
        eligible_tasks_snapshot: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Task A",
            status: "in_progress",
          },
        ],
      });

      let workLogDeleted = false;
      let workLogInserted: unknown;
      let attendancePayload: Record<string, unknown> | undefined;
      let taskCall = 0;
      let attendanceCall = 0;

      createAdminClientMock.mockReturnValue({
        from: (table: string) => {
          if (table === "tasks") {
            taskCall += 1;
            if (taskCall === 1) {
              return chain({
                data: [
                  {
                    id: "11111111-1111-1111-1111-111111111111",
                    assigned_to: "emp-1",
                  },
                ],
                error: null,
              });
            }
            return chain({
              data: [
                {
                  id: "11111111-1111-1111-1111-111111111111",
                  title: "Task A",
                  status: "in_progress",
                },
              ],
              error: null,
            });
          }
          if (table === "work_logs") {
            const api = chain({ data: null, error: null });
            api.delete = () => {
              workLogDeleted = true;
              return api;
            };
            api.insert = (payload: unknown) => {
              workLogInserted = payload;
              return api;
            };
            return api;
          }
          attendanceCall += 1;
          if (attendanceCall === 1) {
            return chain({ data: existing, error: null });
          }
          const api = chain({ data: updated, error: null });
          api.update = (payload: Record<string, unknown>) => {
            attendancePayload = payload;
            return api;
          };
          return api;
        },
      } as never);

      const result = await resubmitAttendance(
        makeUser({ id: "emp-1" }),
        "att-1",
        {
          clockIn: "08:00",
          clockOut: "16:00",
          breakMinutes: 0,
          allocations: [
            {
              type: "task",
              taskId: "11111111-1111-1111-1111-111111111111",
              hours: 2,
            },
            {
              type: "general",
              reason: "تنسيق داخلي",
              hours: 6,
            },
          ],
        },
      );

      expect(result.status).toBe("pending");
      expect(attendancePayload).toMatchObject({
        eligible_tasks_snapshot: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Task A",
            status: "in_progress",
          },
        ],
      });
      expect(workLogDeleted).toBe(true);
      expect(workLogInserted).toEqual([
        {
          user_id: "emp-1",
          task_id: "11111111-1111-1111-1111-111111111111",
          date: "2026-07-25",
          hours: 2,
          description: null,
          approved_by: null,
        },
        {
          user_id: "emp-1",
          task_id: null,
          date: "2026-07-25",
          hours: 6,
          description: "تنسيق داخلي",
          approved_by: null,
        },
      ]);
    });
  });

  describe("approveAttendance", () => {
    it("rejects approving open attendance without clock_out", async () => {
      const row = makeAttendanceRow({
        user_id: "emp-1",
        clock_out: null,
        total_hours: null,
        status: "pending",
      });

      createAdminClientMock.mockReturnValue({
        from: () => chain({ data: row, error: null }),
      } as never);

      await expect(
        approveAttendance(makeUser({ id: "admin-1", role: "admin" }), "att-1"),
      ).rejects.toMatchObject({
        code: "CLOCK_OUT_REQUIRED",
        status: 409,
      });
    });

    it("blocks approving own attendance via assert", async () => {
      const row = makeAttendanceRow({
        user_id: "admin-1",
        status: "pending",
      });

      createAdminClientMock.mockReturnValue({
        from: () => chain({ data: row, error: null }),
      } as never);

      await expect(
        approveAttendance(makeUser({ id: "admin-1", role: "admin" }), "att-1"),
      ).rejects.toMatchObject({
        code: "CANNOT_APPROVE_OWN",
        status: 403,
      });
      expect(sharesMock).not.toHaveBeenCalled();
    });
  });

  describe("rejectAttendance", () => {
    it("rejects rejecting open attendance without clock_out", async () => {
      const row = makeAttendanceRow({
        user_id: "emp-1",
        clock_out: null,
        total_hours: null,
        status: "pending",
      });

      createAdminClientMock.mockReturnValue({
        from: () => chain({ data: row, error: null }),
      } as never);

      await expect(
        rejectAttendance(makeUser({ id: "admin-1", role: "admin" }), "att-1", {
          reason: "غير مكتمل",
        }),
      ).rejects.toMatchObject({
        code: "CLOCK_OUT_REQUIRED",
        status: 409,
      });
    });
  });
});
