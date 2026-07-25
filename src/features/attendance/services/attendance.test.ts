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
  clockIn,
  rejectAttendance,
  updateAttendance,
} from "@/features/attendance/services/attendance";
import type { AttendanceRow } from "@/features/attendance/types/attendance.types";
import {
  getManagedDepartmentId,
  sharesManagedDepartmentWith,
} from "@/features/departments/services/membership-helpers";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

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

  describe("clockIn", () => {
    it("rejects clock-in when approved (closed) attendance already exists", async () => {
      createAdminClientMock.mockReturnValue({
        from: () =>
          chain({
            data: {
              id: "att-1",
              clock_out: "2026-07-25T13:00:00.000Z",
              status: "approved",
            },
            error: null,
          }),
      } as never);

      await expect(
        clockIn(makeUser({ id: "emp-1", role: "employee" })),
      ).rejects.toMatchObject({
        code: "ATTENDANCE_EXISTS",
        status: 409,
      });
    });

    it("rejects duplicate same-day clock-in when still open", async () => {
      createAdminClientMock.mockReturnValue({
        from: () =>
          chain({
            data: {
              id: "att-1",
              clock_out: null,
              status: "pending",
            },
            error: null,
          }),
      } as never);

      await expect(
        clockIn(makeUser({ id: "emp-1", role: "employee" })),
      ).rejects.toMatchObject({
        code: "ALREADY_CLOCKED_IN",
        status: 409,
      });
    });

    it("succeeds when no existing row for today", async () => {
      const inserted = makeAttendanceRow({
        user_id: "emp-1",
        clock_out: null,
        break_minutes: 0,
        total_hours: null,
        status: "pending",
      });

      let insertPayload: Record<string, unknown> | undefined;
      let call = 0;

      createAdminClientMock.mockReturnValue({
        from: () => {
          call += 1;
          if (call === 1) {
            return chain({ data: null, error: null });
          }
          const api = chain({ data: inserted, error: null });
          api.insert = (payload: Record<string, unknown>) => {
            insertPayload = payload;
            return api;
          };
          return api;
        },
      } as never);

      const result = await clockIn(
        makeUser({ id: "emp-1", role: "employee" }),
      );

      expect(insertPayload).toMatchObject({
        user_id: "emp-1",
        date: "2026-07-25",
        clock_out: null,
        break_minutes: 0,
        total_hours: null,
        status: "pending",
      });
      expect(typeof insertPayload?.clock_in).toBe("string");
      expect(result.id).toBe("att-1");
      expect(result.userId).toBe("emp-1");
      expect(result.status).toBe("pending");
      expect(result.clockOut).toBeNull();
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
