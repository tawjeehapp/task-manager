/**
 * Idempotent development dataset seed (M1–M7).
 *
 * Usage:
 *   npm run seed:dev
 *   npm run seed:dev -- --reset
 *
 * Does not replace scripts/seed-admin.ts.
 * Never overwrites existing Auth passwords.
 * --reset deletes only fixed seed UUIDs listed in the catalog.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

import { IDS, RESET_ID_SETS, SEED_USERS } from "./seed-dev/catalog";
import {
  calendarDateInOrgTimezone,
  computeTotalHours,
  countWorkingDays,
  deleteByIds,
  ensureSeedUser,
  nextWorkingDayOnOrAfter,
  orgLocalDateTimeIso,
  shiftOrgDate,
  upsertRows,
} from "./seed-dev/helpers";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type UserMap = Record<string, string>;

async function main() {
  const reset = process.argv.includes("--reset");

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEV_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to run seed:dev in production. Set ALLOW_DEV_SEED=true to override.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(reset ? "seed:dev (--reset)" : "seed:dev");

  // --- Users (never deleted on --reset) ---
  const users: UserMap = {};
  const createdUsers: string[] = [];
  for (const def of SEED_USERS) {
    const result = await ensureSeedUser(admin, def);
    users[def.employeeNumber] = result.id;
    if (result.created) {
      createdUsers.push(def.employeeNumber);
    }
  }
  console.log(`Users ensured: ${SEED_USERS.length} (new: ${createdUsers.length || 0})`);

  if (reset) {
    console.log("Deleting seed-owned rows by fixed IDs…");
    // FK-safe order
    await deleteByIds(admin, "notifications", RESET_ID_SETS.notifications);
    await deleteByIds(admin, "task_comments", RESET_ID_SETS.task_comments);
    await deleteByIds(admin, "announcements", RESET_ID_SETS.announcements);
    await deleteByIds(admin, "employee_requests", RESET_ID_SETS.employee_requests);
    await deleteByIds(admin, "leave_requests", RESET_ID_SETS.leave_requests);
    await deleteByIds(admin, "leave_balances", RESET_ID_SETS.leave_balances);
    await deleteByIds(admin, "leave_types", RESET_ID_SETS.leave_types);
    await deleteByIds(admin, "work_logs", RESET_ID_SETS.work_logs);
    await deleteByIds(
      admin,
      "task_dependencies",
      RESET_ID_SETS.task_dependencies,
    );
    // Subtasks before parents (ON DELETE CASCADE would handle children, but explicit is safer)
    await deleteByIds(admin, "tasks", [
      IDS.taskDesignScreen,
      IDS.taskWireApi,
      IDS.taskReviewPerms,
      IDS.taskDocsDeploy,
      IDS.taskPerf,
      IDS.taskUnassigned,
      IDS.taskDraft,
      IDS.taskLangReview,
      IDS.taskAttendanceUi,
      IDS.taskGatherReqs,
    ]);
    await deleteByIds(admin, "project_members", RESET_ID_SETS.project_members);
    await deleteByIds(admin, "projects", RESET_ID_SETS.projects);
    await deleteByIds(
      admin,
      "attendance_records",
      RESET_ID_SETS.attendance_records,
    );
    await deleteByIds(
      admin,
      "department_memberships",
      RESET_ID_SETS.department_memberships,
    );
    await deleteByIds(admin, "departments", RESET_ID_SETS.departments);
  }

  const adminId = users["0000"];
  const today = calendarDateInOrgTimezone();
  const yesterday = shiftOrgDate(today, -1);
  const daysAgo2 = shiftOrgDate(today, -2);
  const daysAgo3 = shiftOrgDate(today, -3);
  const daysAgo4 = shiftOrgDate(today, -4);

  // --- Departments ---
  await upsertRows(admin, "departments", [
    {
      id: IDS.deptIt,
      name: "تقنية المعلومات",
      description: "قسم تقني للبذور التطويرية",
      manager_id: users["1001"],
      status: "active",
      updated_at: new Date().toISOString(),
    },
    {
      id: IDS.deptCurriculum,
      name: "المناهج والتخطيط",
      description: "قسم المناهج للبذور التطويرية",
      manager_id: users["1002"],
      status: "active",
      updated_at: new Date().toISOString(),
    },
  ]);

  // --- Current memberships only ---
  const membershipStart = daysAgo4;
  await upsertRows(admin, "department_memberships", [
    {
      id: IDS.memIt1001,
      department_id: IDS.deptIt,
      user_id: users["1001"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memIt1003,
      department_id: IDS.deptIt,
      user_id: users["1003"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memIt1004,
      department_id: IDS.deptIt,
      user_id: users["1004"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memIt1005,
      department_id: IDS.deptIt,
      user_id: users["1005"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memCur1002,
      department_id: IDS.deptCurriculum,
      user_id: users["1002"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memCur1006,
      department_id: IDS.deptCurriculum,
      user_id: users["1006"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memCur1007,
      department_id: IDS.deptCurriculum,
      user_id: users["1007"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
    {
      id: IDS.memCur1008,
      department_id: IDS.deptCurriculum,
      user_id: users["1008"],
      start_date: membershipStart,
      end_date: null,
      is_current: true,
    },
  ]);

  // --- Projects ---
  await upsertRows(admin, "projects", [
    {
      id: IDS.projectPlatform,
      department_id: IDS.deptIt,
      name: "منصة إدارة العمل",
      description: "المشروع الرئيسي لمنصة إدارة العمل",
      status: "active",
      priority: "high",
      start_date: daysAgo4,
      end_date: null,
      created_by: adminId,
      updated_at: new Date().toISOString(),
    },
    {
      id: IDS.projectInfra,
      department_id: IDS.deptIt,
      name: "ترقية البنية التحتية",
      description: "مشروع مسودة للبنية التحتية",
      status: "draft",
      priority: "medium",
      start_date: null,
      end_date: null,
      created_by: users["1001"],
      updated_at: new Date().toISOString(),
    },
    {
      id: IDS.projectCurriculum,
      department_id: IDS.deptCurriculum,
      name: "تحديث دليل المناهج",
      description: "تحديث محتوى دليل المناهج",
      status: "active",
      priority: "medium",
      start_date: daysAgo3,
      end_date: null,
      created_by: users["1002"],
      updated_at: new Date().toISOString(),
    },
  ]);

  await upsertRows(admin, "project_members", [
    {
      id: IDS.pmPlatform1001,
      project_id: IDS.projectPlatform,
      user_id: users["1001"],
    },
    {
      id: IDS.pmPlatform1003,
      project_id: IDS.projectPlatform,
      user_id: users["1003"],
    },
    {
      id: IDS.pmPlatform1004,
      project_id: IDS.projectPlatform,
      user_id: users["1004"],
    },
    {
      id: IDS.pmPlatform1005,
      project_id: IDS.projectPlatform,
      user_id: users["1005"],
    },
    {
      id: IDS.pmInfra1001,
      project_id: IDS.projectInfra,
      user_id: users["1001"],
    },
    {
      id: IDS.pmInfra1004,
      project_id: IDS.projectInfra,
      user_id: users["1004"],
    },
    {
      id: IDS.pmCur1002,
      project_id: IDS.projectCurriculum,
      user_id: users["1002"],
    },
    {
      id: IDS.pmCur1006,
      project_id: IDS.projectCurriculum,
      user_id: users["1006"],
    },
    {
      id: IDS.pmCur1007,
      project_id: IDS.projectCurriculum,
      user_id: users["1007"],
    },
    {
      id: IDS.pmCur1008,
      project_id: IDS.projectCurriculum,
      user_id: users["1008"],
    },
  ]);

  // --- Tasks (parents first, then subtasks) ---
  const now = new Date().toISOString();
  await upsertRows(admin, "tasks", [
    {
      id: IDS.taskAttendanceUi,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "إعداد واجهة الحضور",
      description: "مهمة أب لواجهة الحضور",
      status: "in_progress",
      priority: "high",
      assigned_to: users["1003"],
      created_by: users["1001"],
      due_date: shiftOrgDate(today, 7),
      estimated_hours: 12,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskReviewPerms,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "مراجعة الصلاحيات",
      description: "تعتمد على واجهة الحضور",
      status: "todo",
      priority: "medium",
      assigned_to: users["1004"],
      created_by: users["1001"],
      due_date: shiftOrgDate(today, -3),
      estimated_hours: 3,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskDocsDeploy,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "توثيق النشر",
      description: "محجوبة حتى اكتمال مراجعة الصلاحيات",
      status: "blocked",
      priority: "low",
      assigned_to: users["1005"],
      created_by: users["1001"],
      due_date: shiftOrgDate(today, 14),
      estimated_hours: 2,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskPerf,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "تحسين الأداء",
      description: "عبء إضافي على سارة",
      status: "todo",
      priority: "medium",
      assigned_to: users["1003"],
      created_by: users["1001"],
      estimated_hours: 6,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskUnassigned,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "مهمة غير معيّنة",
      description: "بدون معيّن",
      status: "todo",
      priority: "low",
      assigned_to: null,
      created_by: users["1001"],
      estimated_hours: 1,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskGatherReqs,
      project_id: IDS.projectCurriculum,
      parent_task_id: null,
      title: "جمع المتطلبات",
      description: null,
      status: "completed",
      priority: "high",
      assigned_to: users["1007"],
      created_by: users["1002"],
      estimated_hours: 4,
      progress_percentage: 100,
      completed_at: orgLocalDateTimeIso(daysAgo2, 16, 0),
      updated_at: now,
    },
    {
      id: IDS.taskDraft,
      project_id: IDS.projectCurriculum,
      parent_task_id: null,
      title: "صياغة المسودة",
      description: "تعتمد على جمع المتطلبات",
      status: "in_progress",
      priority: "high",
      assigned_to: users["1006"],
      created_by: users["1002"],
      estimated_hours: 8,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
    {
      id: IDS.taskLangReview,
      project_id: IDS.projectCurriculum,
      parent_task_id: null,
      title: "مراجعة لغوية",
      description: null,
      status: "todo",
      priority: "medium",
      assigned_to: users["1008"],
      created_by: users["1002"],
      estimated_hours: 3,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "tasks", [
    {
      id: IDS.taskDesignScreen,
      project_id: IDS.projectPlatform,
      parent_task_id: IDS.taskAttendanceUi,
      title: "تصميم الشاشة",
      description: "مهمة فرعية مكتملة",
      status: "completed",
      priority: "high",
      assigned_to: users["1003"],
      created_by: users["1001"],
      estimated_hours: 4,
      progress_percentage: 100,
      completed_at: orgLocalDateTimeIso(yesterday, 15, 0),
      updated_at: now,
    },
    {
      id: IDS.taskWireApi,
      project_id: IDS.projectPlatform,
      parent_task_id: IDS.taskAttendanceUi,
      title: "ربط الـ API",
      description: "تعتمد على تصميم الشاشة",
      status: "in_progress",
      priority: "high",
      assigned_to: users["1003"],
      created_by: users["1001"],
      estimated_hours: 8,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "task_dependencies", [
    {
      id: IDS.depWireOnDesign,
      task_id: IDS.taskWireApi,
      depends_on_task_id: IDS.taskDesignScreen,
    },
    {
      id: IDS.depReviewOnAttendanceUi,
      task_id: IDS.taskReviewPerms,
      depends_on_task_id: IDS.taskAttendanceUi,
    },
    {
      id: IDS.depDocsOnReview,
      task_id: IDS.taskDocsDeploy,
      depends_on_task_id: IDS.taskReviewPerms,
    },
    {
      id: IDS.depDraftOnGather,
      task_id: IDS.taskDraft,
      depends_on_task_id: IDS.taskGatherReqs,
    },
  ]);

  // --- Attendance scenarios ---
  const saraIn = orgLocalDateTimeIso(today, 9, 0);
  const khalidIn = orgLocalDateTimeIso(today, 8, 0);
  const khalidOut = orgLocalDateTimeIso(today, 16, 0);
  const khalidBreak = 45;
  const khalidHours = computeTotalHours(khalidIn, khalidOut, khalidBreak);

  const noorIn = orgLocalDateTimeIso(yesterday, 8, 0);
  const noorOut = orgLocalDateTimeIso(yesterday, 16, 0);
  const noorHours = computeTotalHours(noorIn, noorOut, 0); // 8.00

  const yousefIn = orgLocalDateTimeIso(yesterday, 9, 0);
  const yousefOut = orgLocalDateTimeIso(yesterday, 15, 30);
  const yousefHours = computeTotalHours(yousefIn, yousefOut, 30);

  const laylaIn = orgLocalDateTimeIso(today, 8, 30);
  const laylaOut = orgLocalDateTimeIso(today, 14, 30);
  const laylaHours = computeTotalHours(laylaIn, laylaOut, 0); // 6.00 — resubmitted pending

  const ahmedIn = orgLocalDateTimeIso(daysAgo2, 7, 30);
  const ahmedOut = orgLocalDateTimeIso(daysAgo2, 15, 0);
  const ahmedHours = computeTotalHours(ahmedIn, ahmedOut, 30); // 7.00

  const omarIn = orgLocalDateTimeIso(daysAgo3, 9, 0);
  const omarOut = orgLocalDateTimeIso(daysAgo3, 14, 30);
  const omarHours = computeTotalHours(omarIn, omarOut, 0); // 5.50

  // Relative dates: replace seed attendance rows each run (IDs only).
  await deleteByIds(
    admin,
    "attendance_records",
    RESET_ID_SETS.attendance_records,
  );

  await upsertRows(admin, "attendance_records", [
    {
      id: IDS.attSaraOpen,
      user_id: users["1003"],
      date: today,
      clock_in: saraIn,
      clock_out: null,
      break_minutes: 0,
      total_hours: null,
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.attKhalidAwaiting,
      user_id: users["1004"],
      date: today,
      clock_in: khalidIn,
      clock_out: khalidOut,
      break_minutes: khalidBreak,
      total_hours: khalidHours,
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.attNoorApproved,
      user_id: users["1005"],
      date: yesterday,
      clock_in: noorIn,
      clock_out: noorOut,
      break_minutes: 0,
      total_hours: noorHours,
      status: "approved",
      approved_by: users["1001"],
      approved_at: orgLocalDateTimeIso(today, 10, 0),
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.attYousefRejected,
      user_id: users["1006"],
      date: yesterday,
      clock_in: yousefIn,
      clock_out: yousefOut,
      break_minutes: 30,
      total_hours: yousefHours,
      status: "rejected",
      approved_by: users["1002"],
      approved_at: orgLocalDateTimeIso(today, 9, 30),
      rejection_reason: "أوقات غير متسقة مع جدول العمل",
      updated_at: now,
    },
    {
      id: IDS.attLaylaResubmitted,
      user_id: users["1007"],
      date: today,
      clock_in: laylaIn,
      clock_out: laylaOut,
      break_minutes: 0,
      total_hours: laylaHours,
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.attAhmedApproved,
      user_id: users["1001"],
      date: daysAgo2,
      clock_in: ahmedIn,
      clock_out: ahmedOut,
      break_minutes: 30,
      total_hours: ahmedHours,
      status: "approved",
      approved_by: adminId,
      approved_at: orgLocalDateTimeIso(daysAgo2, 18, 0),
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.attOmarApprovedOld,
      user_id: users["1008"],
      date: daysAgo3,
      clock_in: omarIn,
      clock_out: omarOut,
      break_minutes: 0,
      total_hours: omarHours,
      status: "approved",
      approved_by: users["1002"],
      approved_at: orgLocalDateTimeIso(daysAgo2, 11, 0),
      rejection_reason: null,
      updated_at: now,
    },
  ]);

  // --- Work logs ---
  await upsertRows(admin, "work_logs", [
    {
      id: IDS.wlSaraParent1,
      user_id: users["1003"],
      task_id: IDS.taskAttendanceUi,
      date: yesterday,
      hours: 2.5,
      description: "تخطيط واجهة الحضور",
      approved_by: null,
      updated_at: now,
    },
    {
      id: IDS.wlSaraSubtask1,
      user_id: users["1003"],
      task_id: IDS.taskDesignScreen,
      date: yesterday,
      hours: 3,
      description: "إنهاء تصميم الشاشة",
      approved_by: null,
      updated_at: now,
    },
    {
      id: IDS.wlSaraParent2,
      user_id: users["1003"],
      task_id: IDS.taskWireApi,
      date: today,
      hours: 1.5,
      description: "بدء ربط الـ API",
      approved_by: null,
      updated_at: now,
    },
    {
      id: IDS.wlKhalid1,
      user_id: users["1004"],
      task_id: IDS.taskReviewPerms,
      date: daysAgo2,
      hours: 1,
      description: "قراءة متطلبات الصلاحيات",
      approved_by: null,
      updated_at: now,
    },
    {
      id: IDS.wlYousef1,
      user_id: users["1006"],
      task_id: IDS.taskDraft,
      date: yesterday,
      hours: 4,
      description: "كتابة المسودة",
      approved_by: null,
      updated_at: now,
    },
    {
      id: IDS.wlLayla1,
      user_id: users["1007"],
      task_id: IDS.taskGatherReqs,
      date: daysAgo3,
      hours: 2,
      description: "جمع المتطلبات",
      approved_by: null,
      updated_at: now,
    },
  ]);

  // --- Leave types / balances / requests (M6) ---
  const leaveYear = Number(today.slice(0, 4));
  const leaveStartPending = nextWorkingDayOnOrAfter(shiftOrgDate(today, 3));
  const leaveEndPending = nextWorkingDayOnOrAfter(shiftOrgDate(leaveStartPending, 2));
  const leavePendingDays = countWorkingDays(leaveStartPending, leaveEndPending);

  const leaveStartApproved = nextWorkingDayOnOrAfter(shiftOrgDate(today, -10));
  const leaveEndApproved = nextWorkingDayOnOrAfter(shiftOrgDate(leaveStartApproved, 1));
  const leaveApprovedDays = countWorkingDays(leaveStartApproved, leaveEndApproved);

  const leaveStartRejected = nextWorkingDayOnOrAfter(shiftOrgDate(today, -20));
  const leaveEndRejected = leaveStartRejected;

  const leaveStartKhalid = nextWorkingDayOnOrAfter(shiftOrgDate(today, 10));
  const leaveEndKhalid = leaveStartKhalid;

  await upsertRows(admin, "leave_types", [
    {
      id: IDS.leaveTypeAnnual,
      name: "إجازة سنوية",
      description: "رصيد الإجازة السنوية",
      is_active: true,
      updated_at: now,
    },
    {
      id: IDS.leaveTypeSick,
      name: "إجازة مرضية",
      description: "إجازة مرضية",
      is_active: true,
      updated_at: now,
    },
    {
      id: IDS.leaveTypeEmergency,
      name: "إجازة طارئة",
      description: "إجازة طارئة قصيرة",
      is_active: true,
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "leave_balances", [
    {
      id: IDS.balSaraAnnual,
      user_id: users["1003"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balKhalidAnnual,
      user_id: users["1004"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balNoorAnnual,
      user_id: users["1005"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: leaveApprovedDays,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balYousefAnnual,
      user_id: users["1006"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balLaylaAnnual,
      user_id: users["1007"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balOmarAnnual,
      user_id: users["1008"],
      leave_type_id: IDS.leaveTypeAnnual,
      allocated_days: 21,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balSaraSick,
      user_id: users["1003"],
      leave_type_id: IDS.leaveTypeSick,
      allocated_days: 10,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
    {
      id: IDS.balKhalidSick,
      user_id: users["1004"],
      leave_type_id: IDS.leaveTypeSick,
      allocated_days: 10,
      used_days: 0,
      year: leaveYear,
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "leave_requests", [
    {
      id: IDS.leavePendingSara,
      user_id: users["1003"],
      leave_type_id: IDS.leaveTypeAnnual,
      start_date: leaveStartPending,
      end_date: leaveEndPending,
      days: leavePendingDays,
      reason: "إجازة شخصية",
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.leaveApprovedNoor,
      user_id: users["1005"],
      leave_type_id: IDS.leaveTypeAnnual,
      start_date: leaveStartApproved,
      end_date: leaveEndApproved,
      days: leaveApprovedDays,
      reason: "إجازة معتمدة",
      status: "approved",
      approved_by: users["1001"],
      approved_at: now,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.leaveRejectedYousef,
      user_id: users["1006"],
      leave_type_id: IDS.leaveTypeAnnual,
      start_date: leaveStartRejected,
      end_date: leaveEndRejected,
      days: 1,
      reason: "طلب مرفوض سابقاً",
      status: "rejected",
      approved_by: users["1002"],
      approved_at: now,
      rejection_reason: "تعارض مع مواعيد المشروع",
      updated_at: now,
    },
    {
      id: IDS.leavePendingKhalid,
      user_id: users["1004"],
      leave_type_id: IDS.leaveTypeSick,
      start_date: leaveStartKhalid,
      end_date: leaveEndKhalid,
      days: 1,
      reason: "موعد طبي",
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      updated_at: now,
    },
  ]);

  const extensionRequested = nextWorkingDayOnOrAfter(shiftOrgDate(today, 21));
  const approvedExtensionDate = nextWorkingDayOnOrAfter(shiftOrgDate(today, 30));

  // Apply approved extension side effect on task due_date (Noor's docs task).
  await upsertRows(admin, "tasks", [
    {
      id: IDS.taskDocsDeploy,
      project_id: IDS.projectPlatform,
      parent_task_id: null,
      title: "توثيق النشر",
      description: "محجوبة حتى اكتمال مراجعة الصلاحيات",
      status: "blocked",
      priority: "low",
      assigned_to: users["1005"],
      created_by: users["1001"],
      due_date: approvedExtensionDate,
      estimated_hours: 2,
      progress_percentage: 0,
      completed_at: null,
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "employee_requests", [
    {
      id: IDS.empReqPendingExtension,
      user_id: users["1003"],
      task_id: IDS.taskAttendanceUi,
      type: "extension",
      reason: "حاجة لمزيد من الوقت للواجهة",
      requested_date: extensionRequested,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.empReqPendingExcusal,
      user_id: users["1004"],
      task_id: IDS.taskReviewPerms,
      type: "excusal",
      reason: "تعارض مع مهام أخرى",
      requested_date: null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      updated_at: now,
    },
    {
      id: IDS.empReqApprovedExtension,
      user_id: users["1005"],
      task_id: IDS.taskDocsDeploy,
      type: "extension",
      reason: "تم تمديد الموعد سابقاً",
      requested_date: approvedExtensionDate,
      status: "approved",
      reviewed_by: users["1001"],
      reviewed_at: now,
      rejection_reason: null,
      updated_at: now,
    },
  ]);

  // --- Milestone 7: Announcements + notifications ---
  const publishPast = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const expirePast = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const expireFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await upsertRows(admin, "announcements", [
    {
      id: IDS.announcementCompany,
      title: "تحديث سياسة العمل عن بُعد",
      content:
        "يرجى مراجعة سياسة العمل عن بُعد المحدّثة في بوابة الموارد البشرية.",
      audience_type: "company",
      department_id: null,
      priority: "high",
      publish_at: publishPast,
      expires_at: expireFuture,
      created_by: users["0000"],
      updated_at: now,
    },
    {
      id: IDS.announcementDeptIt,
      title: "صيانة خوادم التطوير",
      content: "ستتم صيانة بيئة التطوير يوم الخميس من 10 إلى 12.",
      audience_type: "department",
      department_id: IDS.deptIt,
      priority: "medium",
      publish_at: publishPast,
      expires_at: null,
      created_by: users["1001"],
      updated_at: now,
    },
    {
      id: IDS.announcementExpired,
      title: "إعلان منتهٍ — اجتماع الربع السابق",
      content: "هذا الإعلان منتهٍ ويظهر في تبويب المنتهية فقط.",
      audience_type: "company",
      department_id: null,
      priority: "low",
      publish_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: expirePast,
      created_by: users["0000"],
      updated_at: now,
    },
  ]);

  await upsertRows(admin, "notifications", [
    {
      id: IDS.notifSaraAssigned,
      user_id: users["1003"],
      type: "task_assigned",
      title: "تم تعيين مهمة إليك",
      message: "واجهة الحضور",
      entity_type: "task",
      entity_id: IDS.taskAttendanceUi,
      read_at: null,
    },
    {
      id: IDS.notifAhmedApproval,
      user_id: users["1001"],
      type: "approval_request",
      title: "طلب إجازة بانتظار الاعتماد",
      message: "سارة المطورة",
      entity_type: "leave_request",
      entity_id: IDS.leavePendingSara,
      read_at: null,
    },
    {
      id: IDS.notifSaraAnnouncement,
      user_id: users["1003"],
      type: "announcement",
      title: "إعلان جديد",
      message: "تحديث سياسة العمل عن بُعد",
      entity_type: "announcement",
      entity_id: IDS.announcementCompany,
      read_at: now,
    },
  ]);

  await upsertRows(admin, "task_comments", [
    {
      id: IDS.commentSara1,
      task_id: IDS.taskAttendanceUi,
      user_id: users["1003"],
      content: "بدأت العمل على واجهة الحضور. سأشارك مسودة قريباً.",
      created_at: now,
      updated_at: now,
    },
    {
      id: IDS.commentAhmed1,
      task_id: IDS.taskAttendanceUi,
      user_id: users["1001"],
      content: "ممتاز — راجعي أيضاً حالات الاعتماد المرفوض.",
      created_at: now,
      updated_at: now,
    },
    {
      id: IDS.commentKhalid1,
      task_id: IDS.taskWireApi,
      user_id: users["1004"],
      content: "أحتاج مواصفات الـ API قبل المتابعة.",
      created_at: now,
      updated_at: now,
    },
  ]);

  // --- Summary ---
  console.log("\n=== Development seed complete ===\n");
  console.log("Credentials (password = employee number for newly created Auth users).");
  console.log(
    "Existing Auth passwords are never overwritten. Existing must_change_password is left unchanged.\n",
  );
  console.log("Employee | Name                 | Role");
  console.log("---------|----------------------|--------------------");
  for (const u of SEED_USERS) {
    console.log(
      `${u.employeeNumber.padEnd(8)} | ${u.fullName.padEnd(20)} | ${u.role}`,
    );
  }

  console.log("\nDepartments:");
  console.log("  - تقنية المعلومات (manager: أحمد التقني / 1001)");
  console.log("  - المناهج والتخطيط (manager: فاطمة المخططة / 1002)");

  console.log("\nProjects:");
  console.log("  - منصة إدارة العمل (active, IT)");
  console.log("  - ترقية البنية التحتية (draft, IT)");
  console.log("  - تحديث دليل المناهج (active, مناهج)");

  console.log("\nManual QA scenarios:");
  console.log(
    `  • Open attendance today: سارة المطورة (1003) — clocked in, no clock_out`,
  );
  console.log(
    `  • Awaiting approval today (+45m break → ${khalidHours}h): خالد الدعم (1004)`,
  );
  console.log(
    `  • Resubmitted pending today (${laylaHours}h): ليلى الكاتبة (1007)`,
  );
  console.log(
    `  • Approved yesterday (${noorHours}h): نور المهندسة (1005)`,
  );
  console.log(
    `  • Approved ${daysAgo2} (${ahmedHours}h w/ 30m break): أحمد التقني (1001)`,
  );
  console.log(
    `  • Approved ${daysAgo3} (${omarHours}h): عمر المراجع (1008)`,
  );
  console.log(
    `  • Rejected (correctable): يوسف المصمم (1006) — yesterday`,
  );
  console.log(
    `  • No attendance today (empty state): عمر المراجع (1008), فاطمة المخططة (1002)`,
  );
  console.log(
    `  • Uneven workload: سارة has multiple active/todo tasks + subtasks`,
  );
  console.log(
    `  • Dependencies: ربط الـ API ← تصميم الشاشة; توثيق النشر blocked; صياغة المسودة ← جمع المتطلبات`,
  );
  console.log(
    `  • Work logs on parent + subtask + multiple days (سارة / خالد / يوسف / ليلى)`,
  );
  console.log(
    `  • Leave pending (approve as أحمد 1001): سارة / خالد — /approvals → Leave`,
  );
  console.log(
    `  • Leave approved history: نور · rejected: يوسف (فاطمة)`,
  );
  console.log(
    `  • Task extension pending: سارة على إعداد واجهة الحضور — /approvals → Extensions`,
  );
  console.log(
    `  • Task excusal pending: خالد على مراجعة الصلاحيات — /approvals → Excusals`,
  );
  console.log(
    `  • Leave balances / manage types: admin 0000 on /leave → Manage`,
  );
  console.log(
    `  • Gantt: open /projects/{platform}/gantt — bars + dependency lines + overdue`,
  );
  console.log(
    `  • Task comments: سارة/أحمد on إعداد واجهة الحضور; خالد on ربط الـ API`,
  );
  console.log(
    `  • Advanced filters on /tasks: department, assignee, priority, due range`,
  );
  console.log("\nRe-run: npm run seed:dev");
  console.log("Reset seed-owned rows then reseed: npm run seed:dev -- --reset");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
